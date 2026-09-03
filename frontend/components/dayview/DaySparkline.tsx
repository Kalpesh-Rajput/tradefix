"use client";

import clsx from "clsx";

export function DaySparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const pts = values.length >= 2 ? values : [0, values[0] ?? 0];
  const w = 160;
  const h = 64;
  const pad = 2;
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, 0);
  const span = max - min || 1;

  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return { x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const last = pts[pts.length - 1] ?? 0;
  const positive = last >= 0;
  const stroke = positive ? "hsl(var(--positive))" : "hsl(var(--negative))";
  const fill = positive ? "hsl(var(--positive) / 0.18)" : "hsl(var(--negative) / 0.18)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={clsx("h-16 w-full max-w-[180px]", className)}
      aria-hidden
    >
      <polygon points={area} fill={fill} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
