"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { NEGATIVE_HEX } from "@/lib/appearance";

export function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  const { accentHex } = useAppearance();
  const chartData = data.map((v, i) => ({ i, v }));
  const color = positive ? accentHex : NEGATIVE_HEX;
  const id = `spark-${positive ? "p" : "n"}-${data.length}-${data[0] ?? 0}`;

  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
