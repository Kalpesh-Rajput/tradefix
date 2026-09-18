"use client";

export function MarketActivity({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const n = values.length;
  const coords = values.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 100 - (v / max) * 86;
    return `${x},${y}`;
  });
  const line = coords.join(" ");
  const area = `0,100 ${coords.join(" ")} 100,100`;

  return (
    <section className="dash-card p-4">
      <div className="mb-2 flex h-11 items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Typical market activity</h2>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            Conceptual overlap of the major sessions — not live volume
          </p>
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-[var(--color-text-muted)] sm:flex">
          <span>Low</span>
          <span className="h-px w-10 bg-[var(--color-border)]" />
          <span>High</span>
        </div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
        <polygon points={area} fill="var(--color-primary)" opacity="0.12" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
          opacity="0.85"
        />
      </svg>
      <p className="sr-only">
        Typical activity rises when more than one major session is open at the same time.
      </p>
    </section>
  );
}
