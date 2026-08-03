"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/Card";
import { Trade } from "@/lib/types";

type Tab = "weekly" | "monthly" | "equity" | "distribution" | "ratio" | "strategy";

const TABS: { id: Tab; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "equity", label: "Equity Curve" },
  { id: "distribution", label: "Profit Dist." },
  { id: "ratio", label: "Win/Loss" },
  { id: "strategy", label: "Strategies" },
];

export function PerformanceCharts({
  trades,
  bySetup,
}: {
  trades: Trade[];
  bySetup: { setup_tag: string; pnl: number; trades: number }[];
}) {
  const [tab, setTab] = useState<Tab>("equity");

  const closed = useMemo(
    () =>
      [...trades]
        .filter((t) => t.status === "closed" && t.pnl != null)
        .sort((a, b) => new Date(a.closed_at || a.opened_at).getTime() - new Date(b.closed_at || b.opened_at).getTime()),
    [trades]
  );

  const equity = useMemo(() => {
    let sum = 0;
    return closed.map((t, i) => {
      sum += t.pnl ?? 0;
      return { i: i + 1, equity: Number(sum.toFixed(2)), label: t.symbol };
    });
  }, [closed]);

  const weekly = useMemo(() => bucketBy(closed, "week"), [closed]);
  const monthly = useMemo(() => bucketBy(closed, "month"), [closed]);
  const distribution = useMemo(() => {
    const bins = [
      { name: "< -$200", min: -Infinity, max: -200 },
      { name: "-$200–0", min: -200, max: 0 },
      { name: "$0–$100", min: 0, max: 100 },
      { name: "$100–$300", min: 100, max: 300 },
      { name: ">$300", min: 300, max: Infinity },
    ];
    return bins.map((b) => ({
      name: b.name,
      count: closed.filter((t) => (t.pnl ?? 0) >= b.min && (t.pnl ?? 0) < b.max).length,
    }));
  }, [closed]);

  const ratio = useMemo(() => {
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const losses = closed.filter((t) => (t.pnl ?? 0) < 0).length;
    return [
      { name: "Wins", value: wins, color: "#14F195" },
      { name: "Losses", value: losses, color: "#FF5C5C" },
    ];
  }, [closed]);

  const strategy = useMemo(
    () =>
      (bySetup.length ? bySetup : [{ setup_tag: "Untagged", pnl: 0, trades: 0 }]).slice(0, 6).map((s) => ({
        name: s.setup_tag || "Untagged",
        pnl: Number(s.pnl.toFixed(2)),
        trades: s.trades,
      })),
    [bySetup]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Performance Charts</h3>
            <p className="text-xs text-muted">Interactive view of your edge over time</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-background p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                  tab === t.id ? "bg-accent-muted text-accent" : "text-muted hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[280px] px-2 py-4 sm:px-4">
          {closed.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Log closed trades to unlock charts.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {tab === "equity" ? (
                <AreaChart data={equity}>
                  <defs>
                    <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14F195" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#14F195" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="i" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="equity" stroke="#14F195" fill="url(#eq)" strokeWidth={2} />
                </AreaChart>
              ) : tab === "ratio" ? (
                <PieChart>
                  <Pie data={ratio} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={4}>
                    {ratio.map((r) => (
                      <Cell key={r.name} fill={r.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              ) : tab === "strategy" ? (
                <BarChart data={strategy}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="pnl" radius={[8, 8, 0, 0]}>
                    {strategy.map((s) => (
                      <Cell key={s.name} fill={s.pnl >= 0 ? "#14F195" : "#FF5C5C"} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart data={tab === "weekly" ? weekly : tab === "monthly" ? monthly : distribution}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#A1A1AA"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="#A1A1AA" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar
                    dataKey={tab === "distribution" ? "count" : "pnl"}
                    fill="#4F8BFF"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

const tooltipStyle = {
  background: "#0F1115",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  fontSize: 12,
};

function bucketBy(trades: Trade[], mode: "week" | "month") {
  const map = new Map<string, number>();
  for (const t of trades) {
    const d = new Date(t.closed_at || t.opened_at);
    const key =
      mode === "month"
        ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
        : `W${getWeek(d)}`;
    map.set(key, (map.get(key) ?? 0) + (t.pnl ?? 0));
  }
  return [...map.entries()].slice(-8).map(([name, pnl]) => ({ name, pnl: Number(pnl.toFixed(2)) }));
}

function getWeek(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
}
