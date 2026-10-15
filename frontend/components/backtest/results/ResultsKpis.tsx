import type { RunMetrics } from "@/lib/hooks/useBacktestRuns";

function text(value: number | null | undefined, digits = 2, suffix = "") {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

export function ResultsKpis({ metrics }: { metrics: RunMetrics | null }) {
  const cards = [
    { label: "Net profit", value: text(metrics?.net_profit) },
    { label: "Return", value: text(metrics?.return_pct, 2, "%") },
    { label: "Trades", value: metrics?.trade_count == null ? "—" : String(metrics.trade_count) },
    { label: "Win rate", value: metrics?.win_rate == null ? "—" : `${(metrics.win_rate * 100).toFixed(1)}%` },
    { label: "Profit factor", value: text(metrics?.profit_factor) },
    { label: "Expectancy R", value: text(metrics?.expectancy_r) },
    { label: "Max drawdown", value: text(metrics?.max_drawdown) },
    { label: "Average R", value: text(metrics?.average_r) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="dash-card px-3 py-3">
          <dt className="text-xs text-muted">{card.label}</dt>
          <dd className={`mt-1 font-mono text-sm ${card.label === "Net profit" && (metrics?.net_profit ?? 0) < 0 ? "text-negative" : "text-foreground"}`}>{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}
