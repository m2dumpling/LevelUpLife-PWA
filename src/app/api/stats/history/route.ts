import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, or, and } from "drizzle-orm";
import { getUserId } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "gold";

    if (type === "gold") {
      // Gold: reward ledger + lottery + gifts received + PvP rewards
      const rewards = db.select({
        date: schema.rewardLedger.completedDate,
        amount: schema.rewardLedger.goldEarned,
        reversed: schema.rewardLedger.reversedAt,
        title: schema.rewardLedger.taskTitle,
        type: schema.rewardLedger.mode,
      }).from(schema.rewardLedger)
        .where(eq(schema.rewardLedger.userId, userId))
        .orderBy(desc(schema.rewardLedger.createdAt))
        .limit(20).all()
        .map(r => ({ date: r.date, amount: r.reversed ? -r.amount : r.amount, title: r.title + (r.reversed ? " (已撤回)" : ""), source: r.reversed ? "任务撤回" : "任务奖励", type: r.type }));

      const lottery = db.select({ date: schema.lotteryLog.date, prize: schema.lotteryLog.prize })
        .from(schema.lotteryLog).where(eq(schema.lotteryLog.userId, userId))
        .orderBy(desc(schema.lotteryLog.date)).limit(10).all()
        .map(l => ({ date: l.date, amount: 0, title: l.prize, source: "抽奖", type: "lottery" }));

      const gifts = db.select({ date: schema.giftLog.date, giftType: schema.giftLog.giftType, giftValue: schema.giftLog.giftValue, fromUserId: schema.giftLog.fromUserId })
        .from(schema.giftLog).where(eq(schema.giftLog.toUserId, userId))
        .orderBy(desc(schema.giftLog.date)).limit(10).all()
        .map(g => {
          const sender = db.select({ username: schema.user.username }).from(schema.user).where(eq(schema.user.id, g.fromUserId)).get();
          return { date: g.date, amount: g.giftType === "gold" ? parseInt(g.giftValue) : 0, title: `来自 ${sender?.username || "未知"} 的礼物`, source: "礼物", type: "gift" };
        });

      return NextResponse.json([...rewards, ...lottery, ...gifts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30));
    }

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

    // HP history — 从结算记录推算 HP 变化
    if (type === "hp") {
      const user = db.select({ hp: schema.user.hp, maxHp: schema.user.maxHp, hpPenaltyActive: schema.user.hpPenaltyActive, lastSettlementDate: schema.user.lastSettlementDate, lastLoginDate: schema.user.lastLoginDate })
        .from(schema.user).where(eq(schema.user.id, userId)).get();

      // 最近 30 天的 habit 完成记录（HP 不掉的日子 = 完成了当天全部习惯）
      const recentLogs = db.select({ date: schema.habitLog.completedAt })
        .from(schema.habitLog).where(eq(schema.habitLog.userId, userId))
        .orderBy(desc(schema.habitLog.completedAt)).limit(30).all();

      // 最近 30 天的结算日期（有结算就有机会扣血）
      const recentSettlements = db.select({ date: schema.rewardLedger.completedDate, title: schema.rewardLedger.taskTitle, xp: schema.rewardLedger.xpEarned })
        .from(schema.rewardLedger).where(eq(schema.rewardLedger.userId, userId))
        .orderBy(desc(schema.rewardLedger.createdAt)).limit(30).all();

      // 去重日期并标记当天是否有活跃
      const activeDates = new Set(recentLogs.map(l => l.date));
      const result = recentSettlements.map(s => ({
        date: s.date,
        title: s.title,
        xp: s.xp,
        source: activeDates.has(s.date) ? "任务完成 · 生命稳固" : "当日无记录 · 可能扣血",
        type: "settlement",
      }));

      if (result.length === 0) {
        return NextResponse.json([{
          date: user?.lastSettlementDate || "—",
          title: `当前 HP: ${user?.hp ?? "?"} / ${user?.maxHp ?? "?"}`,
          xp: 0,
          source: user?.hpPenaltyActive ? "⚠️ 虚弱状态" : "暂无 HP 变动记录",
          type: "status",
        }]);
      }

      return NextResponse.json(result);
    }

    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}
