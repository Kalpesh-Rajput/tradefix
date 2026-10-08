"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { Component, useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CompactSelect } from "@/components/reports/CompactSelect";

import {
  formatInsightMetric,
  INSIGHT_METRICS,
  insightBarColor,
  insightBarWidth,
  insightMetricValue,
  sortInsightRows,
  type InsightMetric,
  type InsightMetricId,
  type InsightRow,
  type InsightSortDirection,
} from "./insightMetrics";
import { formatPct, pnlClass, tradeLabel, TipCard, type MoneyFormat } from "./shared";

const CHART_BODY_H = 188;

function ChartSkeleton() {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3">
      <div className="mb-3 flex h-8 items-center justify-between gap-2">
        <span className="fx-skeleton h-3 w-24" />
        <span className="fx-skeleton h-8 w-28 rounded-md" />
      </div>
      <div className="flex flex-col justify-center gap-3" style={{ height: CHART_BODY_H }} aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="fx-skeleton h-3 w-full" />
        ))}
      </div>
    </article>
  );
}

function ChartMessage({ title, body }: { title: string; body: string }) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3">
      <h4 className="flex h-8 items-center truncate text-[13px] font-bold text-[var(--color-text-primary)]">{title}</h4>
      <div className="flex items-center justify-center px-3 text-center" style={{ height: CHART_BODY_H }}>
        <p className="text-[12px] leading-4 text-[var(--color-text-muted)]">{body}</p>
      </div>
    </article>
  );
}

export class InsightChartBoundary extends Component<
  { title: string; resetKey: string; children: ReactNode },
  { error: boolean }
> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: false });
    }
  }

  render() {
    if (this.state.error) {
      return <ChartMessage title={this.props.title} body="Couldn’t load this chart." />;
    }
    return this.props.children;
  }
}

export function InsightBarChart({
  title,
  rows,
  metrics,
  currencySymbol,
  formatMoney,
  loading = false,
}: {
  title: string;
  rows: InsightRow[] | null;
  metrics: InsightMetric[];
  currencySymbol: string;
  formatMoney: MoneyFormat;
  loading?: boolean;
}) {
  const listId = useId();
  const [metricId, setMetricId] = useState<InsightMetricId>(metrics[0]?.id ?? "pnl");
  const [direction, setDirection] = useState<InsightSortDirection>("desc");
  const [tip, setTip] = useState<{ index: number; top: number; left: number } | null>(null);

  const metric = metrics.find((item) => item.id === metricId) ?? metrics[0];
  const sorted = useMemo(
    () => (metric ? sortInsightRows(rows ?? [], metric.id, direction) : []),
    [rows, metric, direction]
  );
  const maxAbs = useMemo(() => {
    if (!metric || metric.kind === "percent") return 100;
    return sorted.reduce((max, row) => {
      const value = insightMetricValue(row, metric.id);
      return value == null ? max : Math.max(max, Math.abs(value));
    }, 0);
  }, [sorted, metric]);

  if (loading || rows == null) return <ChartSkeleton />;
  if (!metric) return <ChartMessage title={title} body="No data available" />;

  const descending = direction === "desc";
  const sortLabel = descending
    ? `${title} sorted highest to lowest ${metric.label}. Activate to sort lowest to highest.`
    : `${title} sorted lowest to highest ${metric.label}. Activate to sort highest to lowest.`;

  function showTip(index: number, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const width = 220;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 6;
    const top = below + 120 > window.innerHeight ? Math.max(8, rect.top - 126) : below;
    setTip({ index, top, left });
  }

  const active = tip != null ? sorted[tip.index] : null;

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3">
      <div className="mb-2 flex h-8 items-center justify-between gap-2">
        <h4 className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--color-text-primary)]">{title}</h4>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={sortLabel}
            title={descending ? "Highest to lowest" : "Lowest to highest"}
            onClick={() => setDirection((value) => (value === "desc" ? "asc" : "desc"))}
          >
            {descending ? (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ArrowUpNarrowWide className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <CompactSelect
            value={metric.id}
            options={metrics.map((item) => ({ id: item.id, label: item.label }))}
            onChange={setMetricId}
            ariaLabel={`${title} metric`}
            width={132}
          />
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center text-center" style={{ height: CHART_BODY_H }}>
          <p className="text-[12px] text-[var(--color-text-muted)]">No data available</p>
        </div>
      ) : (
        <ul
          id={listId}
          aria-label={`${title} by ${metric.label}`}
          className="insight-chart-scroll"
          onScroll={() => setTip(null)}
        >
          {sorted.map((row, index) => {
            const value = insightMetricValue(row, metric.id);
            const preciseBar = metric.id === "avg_pnl" || metric.id === "avg_win" || metric.id === "avg_loss";
            const label = formatInsightMetric(metric, value, currencySymbol, formatMoney, preciseBar);
            const full = formatInsightMetric(metric, value, currencySymbol, formatMoney, true);
            const width = insightBarWidth(metric, value, maxAbs);
            const color = insightBarColor(metric, value);
            const described = `${row.name}, ${metric.label} ${full}, ${tradeLabel(row.trades)}, win rate ${formatPct(row.win_rate)}`;
            return (
              <li key={row.name} aria-label={described}>
                <div
                  className="grid w-full grid-cols-[minmax(0,5.75rem)_minmax(2rem,1fr)_auto] items-center gap-2 rounded-md px-1 py-1.5 hover:bg-[var(--color-surface)]"
                  onMouseEnter={(event) => showTip(index, event.currentTarget)}
                  onMouseLeave={() => setTip((current) => (current?.index === index ? null : current))}
                >
                  <span className="truncate text-[12px] font-medium text-[var(--color-text-primary)]" title={row.name}>
                    {row.name}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--color-gauge-track)]" aria-hidden>
                    <span
                      className="block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-150"
                      style={{ width: `${width}%`, background: color ?? "transparent" }}
                    />
                  </span>
                  <span
                    className={`whitespace-nowrap text-right text-[12px] font-semibold tabular-nums ${
                      metric.kind === "signed" || metric.kind === "positiveMoney"
                        ? pnlClass(value)
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {active && tip
        ? createPortal(
            <div className="pointer-events-none fixed z-[230]" style={{ top: tip.top, left: tip.left, width: 220 }}>
              <TipCard title={active.name} rows={tooltipRows(active, metric, currencySymbol, formatMoney)} />
            </div>,
            document.body
          )
        : null}
    </article>
  );
}

function moneyTone(value: number | null): "pos" | "neg" | "neutral" {
  if (value == null || value === 0) return "neutral";
  return value > 0 ? "pos" : "neg";
}

function tooltipRows(row: InsightRow, metric: InsightMetric, currencySymbol: string, formatMoney: MoneyFormat) {
  const value = insightMetricValue(row, metric.id);
  const rows: { label: string; value: string; tone?: "pos" | "neg" | "neutral" }[] = [
    {
      label: metric.label,
      value: formatInsightMetric(metric, value, currencySymbol, formatMoney, true),
      tone: metric.kind === "signed" || metric.kind === "positiveMoney" ? moneyTone(value) : "neutral",
    },
  ];
  if (metric.id !== "trades") rows.push({ label: "Trades", value: String(row.trades) });
  if (metric.id !== "win_rate") rows.push({ label: "Win rate", value: formatPct(row.win_rate) });
  if (metric.id !== "pnl") {
    rows.push({
      label: "Net P&L",
      value: formatInsightMetric(INSIGHT_METRICS.pnl, row.pnl, currencySymbol, formatMoney, true),
      tone: moneyTone(row.pnl),
    });
  }
  return rows;
}
