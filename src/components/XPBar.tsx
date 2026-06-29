"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { xpProgressPercent } from "@/lib/xp-calculator";

interface XPBarProps {
  xp: number;
  xpToNext: number;
  level: number;
}

export function XPBar({ xp, xpToNext, level }: XPBarProps) {
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetPercent = xpProgressPercent(xp, xpToNext);

  useEffect(() => {
    const timer = setTimeout(() => setDisplayPercent(targetPercent), 50);
    return () => clearTimeout(timer);
  }, [targetPercent]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-black text-emerald-400 uppercase tracking-wider shrink-0">Lv.{level}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums font-semibold whitespace-nowrap shrink-0">{xp} / {xpToNext} XP</span>
      </div>
      <div className="relative w-full h-2.5 rounded-full bg-muted overflow-hidden border border-border/40">
        <motion.div
          className="h-full rounded-full shimmer-bar"
          style={{
            background: "linear-gradient(90deg, oklch(0.55 0.2 150) 0%, oklch(0.68 0.22 148) 50%, oklch(0.6 0.2 150) 100%)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${displayPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
