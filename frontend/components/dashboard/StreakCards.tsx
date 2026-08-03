"use client";

import { motion } from "framer-motion";
import { BookOpen, CalendarDays, Flame } from "lucide-react";

const CARDS = [
  {
    key: "win" as const,
    title: "Win Streak",
    icon: Flame,
    wrap: "bg-amber-500/5 border-amber-500/15",
    iconColor: "text-amber-400",
    valueColor: "text-amber-400",
    unit: "days",
  },
  {
    key: "journal" as const,
    title: "Journaled",
    icon: BookOpen,
    wrap: "bg-primary/5 border-primary/15",
    iconColor: "text-primary",
    valueColor: "text-primary",
    unit: "days straight",
  },
  {
    key: "days" as const,
    title: "Days Traded",
    icon: CalendarDays,
    wrap: "bg-blue-500/5 border-blue-500/15",
    iconColor: "text-blue-400",
    valueColor: "text-blue-400",
    unit: "this month",
  },
];

export function StreakCards({
  winStreak,
  journalStreak,
  tradingDays,
}: {
  winStreak: number;
  journalStreak: number;
  tradingDays: number;
}) {
  const values = { win: winStreak, journal: journalStreak, days: tradingDays };

  return (
    <div className="grid grid-cols-3 gap-3">
      {CARDS.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${c.wrap}`}
          >
            <span className={c.iconColor}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className={`font-mono text-xl font-semibold ${c.valueColor}`}>{values[c.key]}</span>
                <span className="text-[10px] text-zinc-500">{c.unit}</span>
              </div>
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{c.title}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
