"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MoodPnlPoint } from "@/lib/types";

export function MoodPnlChart({ data }: { data: MoodPnlPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">Log mood check-ins or tag trade mood to see this chart.</p>;
  }

  const chartData = data.map((d) => ({ ...d, mood_label: `Mood ${d.mood_score}` }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" vertical={false} />
        <XAxis dataKey="mood_label" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: "#1c1c1f", border: "1px solid #2a2a2e", borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="avg_pnl" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.avg_pnl >= 0 ? "#2FBF71" : "#E5484D"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
