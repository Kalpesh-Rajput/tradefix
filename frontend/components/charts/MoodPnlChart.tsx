"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { MoodPnlPoint } from "@/lib/types";

const AXIS = { fontSize: 10, fill: "var(--color-chart-axis)" };
const TOOLTIP = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "var(--shadow-dropdown)",
  padding: "6px 10px",
  color: "var(--color-text-primary)",
};

export function MoodPnlChart({ data }: { data: MoodPnlPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-[12px] text-[var(--color-text-muted)]">
        Log mood check-ins or tag trade mood to see this chart.
      </p>
    );
  }

  const chartData = data.map((d) => ({ ...d, mood_label: `Mood ${d.mood_score}` }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis dataKey="mood_label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
        <Tooltip contentStyle={TOOLTIP} />
        <Bar dataKey="avg_pnl" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.avg_pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
