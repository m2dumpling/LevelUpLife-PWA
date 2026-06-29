"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Swords, Trophy, Gift, X } from "lucide-react";

interface BossData {
  id: number; name: string; emoji: string; hp: number; maxHp: number;
  defeated: boolean; hpPercent: number; dayEnd: string;
  contributions: { userId: number; damage: number; username: string }[];
  totalUsers: number; totalDamage: number; activeUsers: number;
  reward?: { gold: number; description: string } | null;
  damageTable: Record<string, number>;
}

export function BossWidget() {
  const [boss, setBoss] = useState<BossData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateBoss, setCelebrateBoss] = useState<BossData | null>(null);
  const celebratedBossId = useRef<number>(
    typeof window !== "undefined" ? Number(localStorage.getItem("celebratedBossId") || "0") : 0
  );

  const fetchBoss = async () => {
    try {
      const res = await fetch("/api/boss");
      if (res.ok) {
        const data = await res.json();
        setBoss(data);
        if (data.defeated && data.notified && data.id !== celebratedBossId.current) {
          setCelebrateBoss(data); setCelebrate(true);
          celebratedBossId.current = data.id;
          localStorage.setItem("celebratedBossId", String(data.id));
        }
        if (!data.defeated && celebratedBossId.current !== 0) {
          celebratedBossId.current = 0;
          localStorage.removeItem("celebratedBossId");
        }
      }
    } catch {}
  };

  useEffect(() => { fetchBoss(); const iv = setInterval(fetchBoss, 5000); return () => clearInterval(iv); }, []);

  if (!boss) return null;

  return (
    <>
      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setCelebrate(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="arcane-panel bg-card border-amber-500/30 p-8 text-center space-y-4 shadow-2xl max-w-sm w-full"
            >
              <div className="text-6xl animate-bounce">{celebrateBoss?.emoji || "🐉"}</div>
              <h2 className="text-2xl font-black text-amber-400 tracking-tight">⚔️ BOSS 灭杀成功！</h2>
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{celebrateBoss?.name}</span> 已被 {celebrateBoss?.totalUsers} 名勇者合力讨伐
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl py-3 px-4">
                <p className="text-amber-400 font-extrabold text-sm">🏆 全员获得 {celebrateBoss?.reward?.gold || 0} G 赏金</p>
              </div>
              <button onClick={() => setCelebrate(false)}
                className="w-full px-6 py-2.5 bg-amber-500 text-amber-950 rounded-xl font-black text-xs hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer">
                收下赏金
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="arcane-panel p-4 space-y-3 cursor-pointer hover:border-red-500/20 transition-all duration-300"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{boss.emoji}</span>
            <div>
              <span className="text-sm font-bold text-foreground">{boss.name}</span>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full ml-2 font-bold uppercase tracking-wider">WORLD BOSS</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
            <Swords className="w-3.5 h-3.5" />
            <span>{boss.totalUsers}人 · {boss.totalDamage}伤害</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
            <span>HP</span><span className="font-bold tabular-nums">{boss.hp} / {boss.maxHp}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden border border-border/30">
            <motion.div
              animate={{ width: `${boss.hpPercent}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full shimmer-bar ${boss.defeated ? "bg-emerald-500" : "bg-red-500"}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2 flex-wrap gap-2">
          {boss.defeated ? (
            <div className="flex items-center gap-1 text-emerald-400 font-bold">
              <Trophy className="w-3.5 h-3.5" />已斩杀·赏金已入账
            </div>
          ) : (
            <div className="flex items-center gap-1 font-medium">
              <Skull className="w-3.5 h-3.5 text-red-400" />打卡造成伤害
            </div>
          )}
          {boss.contributions.length > 0 && (
            <div className="flex gap-2 text-[10px] flex-wrap items-center">
              <span className="text-amber-400 font-bold">TOP:</span>
              {boss.contributions.slice(0, 3).map((c, i) => (
                <span key={i} className="font-medium">{c.username}<span className="text-red-400 ml-0.5 font-bold">{c.damage}</span></span>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Detail */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="arcane-panel bg-card w-full max-w-sm p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <span className="text-2xl">{boss.emoji}</span>{boss.name}
                </h3>
                <button onClick={() => setShowDetail(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-3">
                <p>👹 <b>每日世界 BOSS</b> — 北京时间每天凌晨刷新。HP 根据社区活跃度动态生成。</p>
                <p>⚔️ <b>讨伐机制</b>：每次完成打卡造成伤害。难度越高伤害越高。</p>
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 space-y-2">
                  <p className="text-foreground font-bold">💥 伤害换算</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {Object.entries(boss.damageTable).map(([diff, dmg]) => (
                      <div key={diff} className="flex justify-between border-b border-border/20 pb-0.5">
                        <span>{diff}</span><span className="text-red-400 font-bold">{dmg}pt</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
                  <p className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Gift className="w-4 h-4" />战利品: {boss.reward?.gold || "?"} G
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
