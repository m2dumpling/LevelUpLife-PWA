/**
 * HP 每日结算引擎 + 不活跃账户清理 + 村庄石料 + 职业分配
 *
 * settleIfNeeded(userId): 单个用户的 HP 结算
 * cleanupInactiveAccounts(): 删除超过 15 天未登录的账户
 */

import { db, schema } from "@/lib/db";
import { eq, and, lt, ne } from "drizzle-orm";
import { getTodayLocal, getYesterdayLocal, getDaysAgoLocal, getNextDayLocal, getDaysBeforeDate, getDayOfWeek, getDayOfMonth } from "@/lib/date-utils";
import { addStoneOnStreak, getVillageEffects } from "@/lib/village";
import { assignClass } from "@/lib/class-analyzer";

const HP_PENALTY_PER_MISSED = 5;
const BASE_HP_RECOVERY_ON_LOGIN = 20;
const INACTIVE_DAYS = 15;
const SETTLE_MAX_DAYS = 365;

let cleanupRanToday = false;

/** 处理宠物喂食与饥饿检测（基于指定日期的习惯完成情况） */
function handlePetFeeding(userId: number, dateStr: string) {
  const pet = db
    .select()
    .from(schema.pet)
    .where(eq(schema.pet.userId, userId))
    .get();
  if (!pet) return;

  const dateLogs = db
    .select()
    .from(schema.habitLog)
    .where(
      and(
        eq(schema.habitLog.userId, userId),
        eq(schema.habitLog.completedAt, dateStr),
      ),
    )
    .all();

  const fed = dateLogs.length > 0;
  db.update(schema.pet)
    .set({ fedToday: fed })
    .where(eq(schema.pet.userId, userId))
    .run();

  if (!fed) {
    // 检查以 dateStr 为基准的最近 3 天（dateStr、dateStr-1、dateStr-2）
    const d2 = getDaysBeforeDate(dateStr, 1);
    const d3 = getDaysBeforeDate(dateStr, 2);

    let hasAnyRecent = false;
    for (const d of [dateStr, d2, d3]) {
      const logs = db
        .select()
        .from(schema.habitLog)
        .where(
          and(
            eq(schema.habitLog.userId, userId),
            eq(schema.habitLog.completedAt, d),
          ),
        )
        .all();
      if (logs.length > 0) {
        hasAnyRecent = true;
        break;
      }
    }

    if (!hasAnyRecent) {
      db.delete(schema.pet)
        .where(eq(schema.pet.userId, userId))
        .run();
      console.log(
        `[pet] Pet deleted for user ${userId} — 3 days unfed`,
      );
    }
  }
}

export function habitMatchesDate(
  frequency: string | null | undefined,
  dateStr: string,
  frequencyDays?: string | null,
): boolean {
  const freq = frequency || "daily";
  if (freq === "daily") return true;
  if (freq === "weekly") {
    if (frequencyDays) return frequencyDays.split(",").map(Number).includes(getDayOfWeek(dateStr));
    return true;
  }
  if (freq === "monthly") {
    if (frequencyDays) return frequencyDays.split(",").map(Number).includes(getDayOfMonth(dateStr));
    return true;
  }
  return true;
}

export function settleIfNeeded(userId: number): {
  hpChanged: boolean; penaltyApplied: boolean; hpLost: number; missedCount: number;
  stoneGained?: number; classAssigned?: string;
} {
  const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
  if (!user) return { hpChanged: false, penaltyApplied: false, hpLost: 0, missedCount: 0 };

  const today = getTodayLocal();
  const yesterday = getYesterdayLocal();
  let hpChanged = false, penaltyApplied = false, hpLost = 0, missedCount = 0;
  let stoneGained = 0;
  let classAssigned: string | undefined;

  // 村庄喷泉加成
  const effects = getVillageEffects(userId);
  const hpRecovery = BASE_HP_RECOVERY_ON_LOGIN + effects.hpRecoveryBonus;

  // 登录恢复
  if (user.lastLoginDate !== today) {
    const newHp = Math.min(user.hp + hpRecovery, user.maxHp);
    if (newHp !== user.hp) {
      db.update(schema.user).set({ hp: newHp, lastLoginDate: today }).where(eq(schema.user.id, userId)).run();
      hpChanged = true;
      if (newHp > 0 && user.hpPenaltyActive) {
        db.update(schema.user).set({ hpPenaltyActive: false }).where(eq(schema.user.id, userId)).run();
      }
    } else {
      db.update(schema.user).set({ lastLoginDate: today }).where(eq(schema.user.id, userId)).run();
    }
  }

  // ── 计算用户级连续天数 (streakDays) ──
  const habits = db.select().from(schema.task).where(and(eq(schema.task.mode, "habit"), eq(schema.task.userId, userId))).all();

  if (!user.lastSettlementDate || user.lastSettlementDate >= yesterday) {
    runCleanupIfNeeded();
    return { hpChanged, penaltyApplied, hpLost, missedCount };
  }

  // ── 一次性加载所有 habitLog，避免循环内逐日查询 ──
  const allLogs = db.select().from(schema.habitLog)
    .where(eq(schema.habitLog.userId, userId))
    .all();
  const logsByDate = new Map<string, Set<number>>();
  for (const log of allLogs) {
    const set = logsByDate.get(log.completedAt) || new Set<number>();
    set.add(log.taskId);
    logsByDate.set(log.completedAt, set);
  }

  // ── 结算从 lastSettlementDate 次日至昨日的每一天 ──
  let currentStreak = user.streakDays;
  let totalMissed = 0;
  let totalHpLost = 0;
  let daysProcessed = 0;

  let settleDate = getNextDayLocal(user.lastSettlementDate);

  // 缺勤超过 365 天时截断，防止请求耗时过长
  const cappedStart = getDaysBeforeDate(yesterday, SETTLE_MAX_DAYS - 1);
  if (settleDate < cappedStart) {
    console.log(`[settle] 用户 ${userId} 缺勤超过 ${SETTLE_MAX_DAYS} 天，从 ${cappedStart} 开始结算`);
    settleDate = cappedStart;
    currentStreak = 0;
  }

  while (settleDate <= yesterday) {
    const dueHabits = habits.filter((h) => habitMatchesDate(h.frequency, settleDate, h.frequencyDays));

    if (dueHabits.length === 0) {
      // 无到期习惯 → 连续天数重置
      currentStreak = 0;
    } else {
      const dayCompletedIds = logsByDate.get(settleDate) || new Set<number>();
      const missed = dueHabits.filter((h) => !dayCompletedIds.has(h.id)).length;

      if (missed > 0) {
        totalMissed += missed;
        totalHpLost += missed * HP_PENALTY_PER_MISSED;
        currentStreak = 0;
      } else {
        // 全部完成 → 连续天数 +1
        currentStreak += 1;
        stoneGained += addStoneOnStreak(userId, currentStreak);
      }
    }

    handlePetFeeding(userId, settleDate);
    daysProcessed++;
    settleDate = getNextDayLocal(settleDate);
  }

  // ── 汇总写入 DB ──
  const newBestStreak = Math.max(currentStreak, user.bestStreak);
  const newTotalDays = user.totalDays + daysProcessed;

  if (totalHpLost > 0) {
    const newHp = Math.max(0, user.hp - totalHpLost);
    db.update(schema.user)
      .set({ hp: newHp, hpPenaltyActive: newHp <= 0, lastSettlementDate: yesterday, streakDays: currentStreak, bestStreak: newBestStreak, totalDays: newTotalDays })
      .where(eq(schema.user.id, userId)).run();
    penaltyApplied = true; hpChanged = true;
    hpLost = totalHpLost;
    missedCount = totalMissed;
  } else {
    db.update(schema.user)
      .set({ lastSettlementDate: yesterday, streakDays: currentStreak, bestStreak: newBestStreak, totalDays: newTotalDays })
      .where(eq(schema.user.id, userId)).run();
  }

  // ── 周一分配职业 ──
  // getDayOfWeek returns 0=Sun, 1=Mon, ..., 6=Sat for the given date string
  if (getDayOfWeek(today) === 1) {
    assignClass(userId);
    const cls = db.select({ className: schema.userClass.className })
      .from(schema.userClass)
      .where(eq(schema.userClass.userId, userId))
      .get();
    if (cls) classAssigned = cls.className;
  }

  runCleanupIfNeeded();
  return { hpChanged, penaltyApplied, hpLost, missedCount, stoneGained, classAssigned };
}

/** 当前用户 HP 惩罚状态 */
export function getHpPenaltyActive(userId: number): boolean {
  const user = db.select({ hpPenaltyActive: schema.user.hpPenaltyActive }).from(schema.user).where(eq(schema.user.id, userId)).get();
  return user?.hpPenaltyActive ?? false;
}

function runCleanupIfNeeded() {
  if (cleanupRanToday) return;
  cleanupRanToday = true;

  const cutoff = getDaysAgoLocal(INACTIVE_DAYS);
  const inactiveUsers = db.select({ id: schema.user.id }).from(schema.user).where(and(lt(schema.user.lastLoginDate, cutoff), ne(schema.user.role, "admin"))).all();

  for (const u of inactiveUsers) {
    const uid = u.id;
    for (const table of [schema.rewardLedger, schema.activityLog, schema.inventory, schema.habitLog, schema.achievement, schema.storyEvent, schema.task, schema.pet, schema.village, schema.userClass, schema.guildMember, schema.guildChat, schema.bossContribution, schema.lotteryLog]) {
      db.delete(table).where(eq(table.userId, uid)).run();
    }
    db.delete(schema.user).where(eq(schema.user.id, uid)).run();
  }

  if (inactiveUsers.length > 0) {
    console.log(`[cleanup] Deleted ${inactiveUsers.length} inactive accounts (last login < ${cutoff})`);
  }
}
