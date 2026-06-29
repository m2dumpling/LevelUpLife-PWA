"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Check, Trash2, Flame, Calendar, Star, Clock, Target, AlertTriangle, Pencil, RotateCcw } from "lucide-react";
import { spawnFloatingNumber } from "./FloatingNumber";
import type { Task } from "@/hooks/useTasks";
import { getTodayLocal, compareDates } from "@/lib/date-utils";

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onUncomplete: (id: number) => void;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const difficultyLabels: Record<string, string> = {
  trivial: "琐碎", easy: "简单", medium: "中等", hard: "困难", heroic: "史诗",
};

const difficultyColors: Record<string, string> = {
  trivial: "text-muted-foreground",
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-orange-400",
  heroic: "text-purple-400",
};

const difficultyBg: Record<string, string> = {
  trivial: "bg-muted-foreground",
  easy: "bg-emerald-500",
  medium: "bg-amber-500",
  hard: "bg-orange-500",
  heroic: "bg-purple-500",
};

const frequencyLabels: Record<string, string> = {
  daily: "每日", weekly: "每周", monthly: "每月",
};

const timeOfDayLabels: Record<string, string> = {
  morning: "早晨", afternoon: "下午", evening: "晚上", anytime: "随时",
};

export function TaskCard({ task, onComplete, onDelete, onEdit, onUncomplete }: TaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const today = getTodayLocal();

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    spawnFloatingNumber(e.clientX, e.clientY, `+${task.xpReward} XP`, "#4ade80");
    setTimeout(() => {
      spawnFloatingNumber(e.clientX + 15, e.clientY - 20, `+${task.goldReward} 🪙`, "#fbbf24");
    }, 200);
    onComplete(task.id);
  };

  const isHabit = task.mode === "habit";
  const isPlan = task.mode === "plan";
  const diffColor = difficultyColors[task.difficulty] || "";
  const diffBg = difficultyBg[task.difficulty] || "";

  let isToday = true;
  let isExpired = false;
  if (isHabit) {
    if (task.startDate && compareDates(task.startDate, today) > 0) isToday = false;
    if (task.endDate && compareDates(task.endDate, today) < 0) { isToday = false; isExpired = true; }
  }
  if (isPlan && task.targetDate) {
    const cmp = compareDates(task.targetDate, today);
    if (cmp < 0) { isToday = false; isExpired = true; }
    else if (cmp > 0) isToday = false;
  }

  const canComplete = isToday && !task.completed;

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, height: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`
        group relative flex items-center gap-3 p-3 rounded-2xl select-none overflow-hidden
        transition-all duration-300
        ${task.completed
          ? "bg-muted/30 border border-border/20 opacity-60"
          : isExpired
          ? "bg-destructive/5 border border-destructive/15 opacity-55"
          : canComplete
          ? `arcane-panel cursor-pointer hover:border-primary/30`
          : "bg-card/50 border border-border/30 opacity-55"
        }
      `}
      whileHover={canComplete ? { scale: 1.008 } : {}}
      onClick={canComplete ? handleComplete : undefined}
    >
      {/* 难度光条 */}
      {!task.completed && (
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${diffBg} opacity-80`} />
      )}

      {/* 完成按钮 */}
      {canComplete ? (
        <button
          onClick={handleComplete}
          className="relative flex-shrink-0 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all duration-200 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 hover:scale-110 active:scale-90"
        >
          <Check className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ) : (
        <div className={`relative flex-shrink-0 w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center ${task.completed ? "bg-primary border-primary" : "border-muted-foreground/15"}`}>
          {task.completed && <Check className="w-3 h-3 text-primary-foreground" />}
          {isExpired && !task.completed && <AlertTriangle className="w-3 h-3 text-red-400/40" />}
        </div>
      )}

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-sm font-semibold truncate min-w-0 ${task.completed ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
            {task.title}
          </span>
          {isHabit ? (
            <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          )}
          {isHabit && task.streakCount > 0 && (
            <span className="text-[10px] font-bold text-orange-400 flex-shrink-0 flex items-center gap-0.5">
              <Star className="w-3 h-3" />{task.streakCount}天
            </span>
          )}
        </div>

        {task.description && (
          <p className={`text-xs mt-0.5 ${task.completed ? "text-muted-foreground/40" : "text-muted-foreground/80"}`}>
            {task.description}
          </p>
        )}

        {isHabit && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
              <Clock className="w-3 h-3" />{frequencyLabels[task.frequency || "daily"]}
            </span>
            {task.frequency === "weekly" && task.frequencyDays && (
              <span className="text-[10px] text-muted-foreground/70">
                · {task.frequencyDays.split(",").map((d) => WEEKDAY_LABELS[parseInt(d)]).join("")}
              </span>
            )}
            {task.timeOfDay && task.timeOfDay !== "anytime" && (
              <span className="text-[10px] text-muted-foreground/70">· {timeOfDayLabels[task.timeOfDay]}</span>
            )}
            {task.reminderTime && (
              <span className="text-[10px] text-amber-500/80 flex items-center gap-0.5 font-medium">
                <Clock className="w-3 h-3" />{task.reminderTime}
              </span>
            )}
          </div>
        )}

        {isPlan && task.targetDate && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3 text-muted-foreground" />
              <span className={`text-[10px] font-medium ${isExpired ? "text-red-400/80" : diffColor}`}>
                {task.targetDate}{isExpired && " · 已过期"}
              </span>
            </span>
            {task.reminderTime && (
              <span className="text-[10px] text-amber-500/80 flex items-center gap-0.5 font-medium">
                <Clock className="w-3 h-3" />{task.reminderTime}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${diffColor} bg-current/5 border-current/15`}>
          {difficultyLabels[task.difficulty]}
        </span>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-bold text-emerald-400">+{task.xpReward}XP</span>
          <span className="text-[10px] font-bold text-amber-400">+{task.goldReward}G</span>
        </div>

        {/* 操作区 — 移动端常显，桌面端 hover 淡入 */}
        <div className="flex items-center gap-0.5 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1 hover:bg-muted/60 rounded-md transition-colors" title="编辑">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          {task.completed && (
            <button onClick={(e) => { e.stopPropagation(); onUncomplete(task.id); }} className="p-1 hover:bg-amber-500/10 rounded-md transition-colors" title="撤销">
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1 hover:bg-destructive/10 rounded-md transition-colors" title="删除">
            <Trash2 className="w-3.5 h-3.5 text-destructive/50 hover:text-destructive" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
