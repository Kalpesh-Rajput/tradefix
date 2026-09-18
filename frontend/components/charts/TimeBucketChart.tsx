"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { TimeBucketStat } from "@/lib/types";

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

export function TimeBucketChart({ data }: { data: TimeBucketStat[] }) {
  const { accentHex } = useAppearance();
  const chartData = data.filter((d) => d.trades > 0);

  if (chartData.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-[12px] text-[var(--color-text-muted)]">
        Not enough closed trades yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" width={40} />
        <Tooltip
          contentStyle={TOOLTIP}
          formatter={(value: number, name: string) => [name === "win_rate" ? `${value}%` : value, name]}
        />
        <Bar dataKey="win_rate" fill={accentHex} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
