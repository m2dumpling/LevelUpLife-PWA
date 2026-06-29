import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, and, or, gte } from "drizzle-orm";
import { getUserId } from "@/lib/auth";
import { getDaysAgoLocal, getTodayLocal } from "@/lib/date-utils";
import { habitMatchesDate } from "@/lib/daily-settlement";

const HP_PENALTY_PER_MISSED = 5;

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "gold";

    // ═══════════════════════════════════════
    // Gold — 收支双方向
    // ═══════════════════════════════════════
    if (type === "gold") {
      const items: any[] = [];

      // 任务奖励 / 撤回
      const rewards = db.select({
        date: schema.rewardLedger.completedDate,
        amount: schema.rewardLedger.goldEarned,
        reversed: schema.rewardLedger.reversedAt,
        title: schema.rewardLedger.taskTitle,
        type: schema.rewardLedger.mode,
      }).from(schema.rewardLedger)
        .where(eq(schema.rewardLedger.userId, userId))
        .orderBy(desc(schema.rewardLedger.createdAt))
        .limit(30).all()
        .map(r => ({
          date: r.date,
          amount: r.reversed ? -r.amount : r.amount,
          title: r.title + (r.reversed ? " (已撤回)" : ""),
          source: r.reversed ? "任务撤回" : "任务奖励",
        }));
      items.push(...rewards);

      // 抽奖
      const lottery = db.select({ date: schema.lotteryLog.date, prize: schema.lotteryLog.prize })
        .from(schema.lotteryLog).where(eq(schema.lotteryLog.userId, userId))
        .orderBy(desc(schema.lotteryLog.date)).limit(10).all()
        .map(l => ({ date: l.date, amount: 0, title: l.prize, source: "每日抽奖" }));
      items.push(...lottery);

      // 收到礼物 (+)
      const giftsReceived = db.select({ date: schema.giftLog.date, giftType: schema.giftLog.giftType, giftValue: schema.giftLog.giftValue, fromUserId: schema.giftLog.fromUserId })
        .from(schema.giftLog).where(eq(schema.giftLog.toUserId, userId))
        .orderBy(desc(schema.giftLog.date)).limit(10).all()
        .map(g => {
          const sender = db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, g.fromUserId)).get();
          return {
            date: g.date,
            amount: g.giftType === "gold" ? parseInt(g.giftValue) : 0,
            title: `来自 ${sender?.username || "?"} 的${g.giftType === "ore" ? "矿石" : "金币"}礼物`,
            source: "收到礼物",
          };
        });
      items.push(...giftsReceived);

      // 送出礼物 (-)
      const giftsSent = db.select({ date: schema.giftLog.date, giftType: schema.giftLog.giftType, giftValue: schema.giftLog.giftValue, toUserId: schema.giftLog.toUserId })
        .from(schema.giftLog).where(eq(schema.giftLog.fromUserId, userId))
        .orderBy(desc(schema.giftLog.date)).limit(10).all()
        .map(g => {
          const receiver = db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, g.toUserId)).get();
          return {
            date: g.date,
            amount: g.giftType === "gold" ? -parseInt(g.giftValue) : 0,
            title: `赠予 ${receiver?.username || "?"} ${g.giftType === "ore" ? "矿石" : "金币"}`,
            source: "送出礼物",
          };
        });
      items.push(...giftsSent);

      // PvP 战绩
      const pvpMatches = db.select()
        .from(schema.pvpMatch)
        .where(and(
          eq(schema.pvpMatch.status, "completed"),
          or(eq(schema.pvpMatch.player1Id, userId), eq(schema.pvpMatch.player2Id, userId)),
        ))
        .orderBy(desc(schema.pvpMatch.createdAt))
        .limit(20).all();

      for (const m of pvpMatches) {
        const isPlayer1 = m.player1Id === userId;
        const oppId = isPlayer1 ? (m.player2Id ?? 0) : m.player1Id;
        const oppName = oppId ? db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, oppId)).get()?.username : "?";

        const result = m.result ? JSON.parse(m.result as string) : {};
        const isDraw = result.draw || (m.winnerId === null);
        const isWin = m.winnerId === userId;
        const prize = m.bet * 2 - 2; // pot - tax

        let amount: number;
        let source: string;
        if (isDraw) {
          amount = 0;
          source = "PvP 平局退款";
        } else if (isWin) {
          amount = prize - m.bet; // net gain
          source = "PvP 胜利";
        } else {
          amount = -m.bet;
          source = "PvP 败北";
        }

        items.push({
          date: m.createdAt.split("T")[0],
          amount,
          title: `${m.type === "rps" ? "猜拳" : m.type === "dice" ? "骰子" : "速算"} · vs ${oppName}`,
          source,
        });
      }

      // Boss 奖励 (从 reward_ledger 里可能没单独标记，但 boss 发放直接在 checkBossDefeatedReward 中 addGold)
      // 无法追溯，暂略

      return NextResponse.json(
        items
          .filter(i => i.amount !== 0 || i.source === "每日抽奖")
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 40)
      );
    }

    // ═══════════════════════════════════════
    // XP — 仅有增益（XP 不扣减）
    // ═══════════════════════════════════════
    if (type === "xp") {
      const rewards = db.select({
        date: schema.rewardLedger.completedDate,
        xp: schema.rewardLedger.xpEarned,
        title: schema.rewardLedger.taskTitle,
        levelBefore: schema.rewardLedger.levelBefore,
        levelAfter: schema.rewardLedger.levelAfter,
      }).from(schema.rewardLedger)
        .where(eq(schema.rewardLedger.userId, userId))
        .orderBy(desc(schema.rewardLedger.id))
        .limit(30).all();

      return NextResponse.json(rewards);
    }

    // ═══════════════════════════════════════
    // HP — 逐日结算明细（扣血 + 登录恢复）
    // ═══════════════════════════════════════
    if (type === "hp") {
      const user = db.select().from(schema.user).where(eq(schema.user.id, userId)).get();
      if (!user) return NextResponse.json([]);

      const habits = db.select().from(schema.task)
        .where(and(eq(schema.task.mode, "habit"), eq(schema.task.userId, userId)))
        .all();

      const today = getTodayLocal();
      const result: any[] = [];

      // 当前状态
      result.push({
        date: today,
        title: `当前 HP: ${user.hp} / ${user.maxHp}`,
        xp: 0,
        amount: user.hp,
        source: user.hpPenaltyActive ? "⚠️ 虚弱状态 · XP 收益 -10%" : "正常状态",
        type: "status",
      });

      // 回溯最近 60 天的每日结算
      if (habits.length > 0 && user.lastSettlementDate) {
        const allLogs = db.select().from(schema.habitLog)
          .where(and(eq(schema.habitLog.userId, userId), gte(schema.habitLog.completedAt, getDaysAgoLocal(60))))
          .all();
        const logsByDate = new Map<string, Set<number>>();
        for (const l of allLogs) {
          const s = logsByDate.get(l.completedAt) || new Set();
          s.add(l.taskId);
          logsByDate.set(l.completedAt, s);
        }

        // 从 yesterday 回溯最多 60 天
        for (let daysAgo = 1; daysAgo <= 60; daysAgo++) {
          const checkDate = getDaysAgoLocal(daysAgo);
          if (checkDate < (user.lastSettlementDate ?? "")) break;

          const dueHabits = habits.filter(h => habitMatchesDate(h.frequency, checkDate, h.frequencyDays));
          if (dueHabits.length === 0) continue;

          const completedSet = logsByDate.get(checkDate) || new Set<number>();
          const missed = dueHabits.filter(h => !completedSet.has(h.id)).length;

          if (missed > 0) {
            const penalty = missed * HP_PENALTY_PER_MISSED;
            result.push({
              date: checkDate,
              title: `${dueHabits.length} 项习惯 · ${missed} 项未完成`,
              xp: 0,
              amount: -penalty,
              source: "每日结算扣血",
              type: "penalty",
            });
          }
        }
      }

      // 登录恢复（最近的登录日）
      if (user.lastLoginDate) {
        result.push({
          date: user.lastLoginDate,
          title: "登录恢复 HP",
          xp: 0,
          amount: 20,
          source: "每日登录 · 自动恢复 +20 HP",
          type: "recovery",
        });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json([]);
  } catch (e) {
    console.error("History error:", e);
    return NextResponse.json([]);
  }
}
