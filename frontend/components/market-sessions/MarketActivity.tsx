"use client";

import type { MarketSessionSnapshot } from "@/lib/market-sessions/types";

const REGION_LABEL: Record<string, string> = {
  sydney: "Asia",
  tokyo: "Asia",
  london: "London",
  new_york: "New York",
};

export function MarketActivity({ snapshot }: { snapshot: MarketSessionSnapshot }) {
  const values = snapshot.activity;
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const n = values.length;
  const coords = values.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 18 + (1 - v / max) * 70;
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `0,100 ${coords.join(" ")} 100,100`;

  const labels = Object.values(
    snapshot.rows.reduce<Record<string, { id: string; label: string; x: number; n: number }>>((acc, row) => {
      if (!row.segments.length) return acc;
      const seg = row.segments.reduce((best, s) =>
        s.endPct - s.startPct > best.endPct - best.startPct ? s : best
      );
      const label = REGION_LABEL[row.def.id] ?? row.def.name;
      const x = (seg.startPct + seg.endPct) / 2;
      const prev = acc[label];
      acc[label] = prev
        ? { id: prev.id, label, x: (prev.x * prev.n + x) / (prev.n + 1), n: prev.n + 1 }
        : { id: row.def.id, label, x, n: 1 };
      return acc;
    }, {})
  );

  return (
    <section className="ms-card p-3.5 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            Market activity
          </h2>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            Typical activity pattern from session overlap — not live volume
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          <span>Low</span>
          <span className="h-px w-8 bg-[var(--color-border)]" />
          <span>High</span>
        </div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[64px] w-full" aria-hidden>
        <polygon points={area} fill="var(--color-primary)" opacity="0.1" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
          opacity="0.9"
        />
      </svg>
      <div className="relative mt-1 h-4">
        {labels.map((item) => (
          <span
            key={item.id}
            className="absolute -translate-x-1/2 text-[10px] font-medium text-[var(--color-text-muted)]"
            style={{ left: `${item.x}%` }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
