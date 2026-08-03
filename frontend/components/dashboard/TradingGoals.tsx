"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { Card, CardHeader } from "@/components/ui/Card";

type Goal = { id: string; label: string; done: boolean };

const DEFAULTS: Goal[] = [
  { id: "profit", label: "Daily Profit Goal", done: false },
  { id: "loss", label: "Maximum Daily Loss respected", done: true },
  { id: "plan", label: "Follow Trading Plan", done: false },
  { id: "meditate", label: "Meditation", done: false },
  { id: "journal", label: "Journal Completed", done: false },
];

export function TradingGoals({ journalDone }: { journalDone?: boolean }) {
  const storageKey = "tradefix_daily_goals";
  const [goals, setGoals] = useState<Goal[]>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setGoals(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (journalDone) {
      setGoals((g) => g.map((x) => (x.id === "journal" ? { ...x, done: true } : x)));
    }
  }, [journalDone]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(goals));
  }, [goals]);

  const pct = useMemo(() => {
    const done = goals.filter((g) => g.done).length;
    return Math.round((done / goals.length) * 100);
  }, [goals]);

  function toggle(id: string) {
    setGoals((g) => g.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardHeader title="Trading Goals" subtitle="Daily process checklist" />
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">Completion</span>
            <span className="font-medium text-accent">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        <ul className="space-y-2">
          {goals.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.03]"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border text-[10px] ${
                    g.done
                      ? "border-accent bg-accent text-black"
                      : "border-white/[0.12] bg-transparent text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={`text-sm ${g.done ? "text-muted line-through" : "text-white"}`}>{g.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </motion.div>
  );
}
