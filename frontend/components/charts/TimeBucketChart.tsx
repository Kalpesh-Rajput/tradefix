"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { TimeBucketStat } from "@/lib/types";

export function TimeBucketChart({ data }: { data: TimeBucketStat[] }) {
  const { accentHex } = useAppearance();
  const chartData = data.filter((d) => d.trades > 0);

  if (chartData.length === 0) {
    return <p className="text-sm text-gray-500">Not enough closed trades yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" vertical={false} />
        <XAxis dataKey="bucket" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: "#1c1c1f", border: "1px solid #2a2a2e", borderRadius: 8, fontSize: 12 }}
          formatter={(value: number, name: string) => [name === "win_rate" ? `${value}%` : value, name]}
        />
        <Bar dataKey="win_rate" fill={accentHex} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
