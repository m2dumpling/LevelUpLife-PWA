"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Coins, Heart, Flame, Zap, Trophy, X } from "lucide-react";
import { XPBar } from "./XPBar";
import type { UserStats } from "@/hooks/useTasks";

interface StatDashboardProps {
  stats: UserStats | null;
  loading: boolean;
}

export function StatDashboard({ stats, loading }: StatDashboardProps) {
  const [detail, setDetail] = useState<{ type: string; label: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openDetail = async (type: string, label: string) => {
    setDetail({ type, label });
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/stats/history?type=${type}`);
      if (res.ok) setHistory(await res.json());
    } catch {}
    setHistoryLoading(false);
  };

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 bg-card animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: "等级", type: "xp", value: stats.level.toString(), icon: Swords, color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5", glow: "glow-ring" },
    { label: "金币", type: "gold", value: stats.gold.toString(), icon: Coins, color: "text-amber-400", bg: "from-amber-500/10 to-amber-500/5", glow: "glow-ring-amber" },
    { label: stats.hpPenaltyActive ? "生命值 ⚠️" : "生命值", type: "hp", value: `${stats.hp}/${stats.maxHp}`, icon: Heart, color: stats.hpPenaltyActive ? "text-red-500" : "text-red-400", bg: "from-red-500/10 to-red-500/5", glow: stats.hpPenaltyActive ? "glow-ring-crimson" : "" },
    { label: "连续天数", type: "xp", value: stats.streakDays.toString(), icon: Flame, color: stats.streakDays > 0 ? "text-orange-400" : "text-muted-foreground", bg: "from-orange-500/10 to-orange-500/5", glow: "" },
    { label: "最佳连续", type: "xp", value: stats.bestStreak.toString(), icon: Trophy, color: stats.bestStreak > 0 ? "text-amber-400" : "text-muted-foreground", bg: "from-amber-500/10 to-amber-500/5", glow: "" },
    { label: "累计天数", type: "xp", value: stats.totalDays.toString(), icon: Zap, color: "text-blue-400", bg: "from-blue-500/10 to-blue-500/5", glow: "" },
  ];

  return (
    <div className="arcane-panel p-5 space-y-5">
      {/* 属性卡片 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            onClick={() => openDetail(card.type, card.label)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            whileHover={{ y: -2 }}
            className={`relative overflow-hidden rounded-2xl border border-border/60 p-3 cursor-pointer transition-all duration-300 hover:border-primary/30 bg-gradient-to-br ${card.bg} ${card.glow}`}
          >
            <div className="flex items-center gap-1 mb-1">
              <card.icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${card.color}`} />
              <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase font-bold tracking-wider truncate">
                {card.label}
              </span>
            </div>
            <motion.span
              key={`${card.label}-${card.value}`}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className={`text-base lg:text-lg font-black tracking-tight truncate block ${card.color}`}
            >
              {card.value}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {/* XP 进度条 */}
      <XPBar xp={stats.xp} xpToNext={stats.xpToNext} level={stats.level} />

      <p className="text-[10px] text-muted-foreground text-center font-medium tracking-wide">
        距离 Lv.{stats.level + 1} 还需 {stats.xpToNext - stats.xp} XP
      </p>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="arcane-panel bg-card w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  📊 {detail.label} 历史明细
                </h3>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {historyLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-12">查阅典籍中...</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">暂无冒险记录</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-muted/40 border border-border/20">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-foreground font-semibold truncate">{h.title || h.source}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{h.date} · {h.source || h.type}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {h.amount !== undefined && (
                            <span className={`font-bold tabular-nums text-[11px] ${h.amount >= 0 ? "text-amber-400" : "text-red-400"}`}>
                              {h.amount > 0 ? "+" : ""}{h.amount}G
                            </span>
                          )}
                          {h.xp !== undefined && (
                            <span className="font-bold tabular-nums text-[11px] text-emerald-400">+{h.xp}XP</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-3 border-t border-border/60 shrink-0">
                <button onClick={() => setDetail(null)} className="w-full py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-sm font-semibold text-foreground transition-colors">
                  关闭卷轴
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
