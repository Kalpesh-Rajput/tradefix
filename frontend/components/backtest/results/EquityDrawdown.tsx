export function EquityDrawdown({ points }: { points: { t: number; v: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted">Not enough points for an equity curve.</p>;
  }
  const values = points.map((point) => point.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 640;
  const height = 160;
  const step = width / (points.length - 1);
  const line = points.map((point, index) => `${index * step},${height - ((point.v - min) / span) * height}`).join(" ");
  let peak = values[0];
  const drawdown = values.map((value) => {
    peak = Math.max(peak, value);
    return peak - value;
  });
  const ddMax = Math.max(...drawdown) || 1;
  const dd = drawdown.map((value, index) => `${index * step},${(value / ddMax) * 48}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <div className="dash-card p-4">
      <h2 className="text-sm font-medium text-foreground">Equity</h2>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-40 w-full" role="img" aria-label="Equity curve">
        <polyline fill="none" stroke={up ? "var(--color-chart-profit)" : "var(--color-chart-loss)"} strokeWidth="2" points={line} />
      </svg>
      <h3 className="mt-3 text-xs text-muted">Drawdown</h3>
      <svg viewBox={`0 0 ${width} 48`} className="mt-1 h-12 w-full" role="img" aria-label="Drawdown">
        <polyline fill="none" stroke="var(--color-chart-loss)" strokeWidth="2" points={dd} />
      </svg>
    </div>
  );
}
