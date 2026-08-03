"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { fmtMoney, fmtPct } from "@/lib/format";

type Stat = {
  label: string;
  value: string;
  trend?: number;
  tone?: "accent" | "danger" | "neutral";
};

export function QuickStats({
  ytd,
  winRate,
  profitFactor,
  avgRr,
  totalTrades,
  todaysTrades,
}: {
  ytd: number;
  winRate: number;
  profitFactor: number;
  avgRr: number;
  totalTrades: number;
  todaysTrades: number;
}) {
  const stats: Stat[] = [
    { label: "YTD Return", value: fmtMoney(ytd), trend: ytd >= 0 ? 2.4 : -1.2, tone: ytd >= 0 ? "accent" : "danger" },
    { label: "Win Rate", value: fmtPct(winRate), trend: 1.1, tone: "neutral" },
    { label: "Profit Factor", value: profitFactor ? profitFactor.toFixed(2) : "—", trend: 0.4, tone: "accent" },
    { label: "Average RR", value: avgRr ? `1:${avgRr.toFixed(1)}` : "—", trend: 0.2, tone: "neutral" },
    { label: "Total Trades", value: String(totalTrades), tone: "neutral" },
    { label: "Today's Trades", value: String(todaysTrades), tone: "neutral" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.4 }}
        >
          <Card hover className="h-full !p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
            <p
              className={`mt-2 text-xl font-semibold tracking-tight ${
                s.tone === "accent" ? "text-accent" : s.tone === "danger" ? "text-danger" : "text-white"
              }`}
            >
              {s.value}
            </p>
            {s.trend !== undefined && (
              <div
                className={`mt-2 inline-flex items-center gap-1 text-[11px] ${
                  s.trend >= 0 ? "text-accent" : "text-danger"
                }`}
              >
                {s.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(s.trend).toFixed(1)}%
              </div>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
