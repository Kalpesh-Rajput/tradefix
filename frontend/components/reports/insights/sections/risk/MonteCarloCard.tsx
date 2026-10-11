"use client";

import { useId, useMemo } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { AdvancedAnalytics, McBand } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { AXIS_TICK, GRID_STROKE, TooltipRow, TooltipShell } from "../../ui/chart";
import { InsightCard, InsufficientState, Stat } from "../../ui/InsightCard";

const CHART_H = 236;

type Row = McBand & { outer: [number, number]; inner: [number, number] };

export function MonteCarloCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const gid = useId().replace(/:/g, "");
  const { accentHex } = useAppearance();
  const mc = data.risk.monte_carlo;
  const animate = !prefersReducedMotion();
  const rows = useMemo<Row[]>(
    () => mc.bands.map((b) => ({ ...b, outer: [b.p5, b.p95], inner: [b.p25, b.p75] })),
    [mc.bands]
  );
  const ok = mc.status === "ok" && rows.length > 1;
  const histColor = (mc.historical_final_pnl ?? 0) >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX;

  return (
    <InsightCard
      title="Monte Carlo outcome range"
      caption={
        ok
          ? `Simulated outcomes, not a forecast · ${mc.paths?.toLocaleString()} reshuffles of your ${mc.sample_size} trades over ${mc.horizon} trades`
          : "Simulated outcomes from reshuffling your own trade results"
      }
      hint={mc.assumptions.join(" ")}
      actions={
        ok ? (
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Simulation
          </span>
        ) : null
      }
    >
      {!ok ? (
        <InsufficientState reason={mc.reason} height={CHART_H + 120} />
      ) : (
        <div className="flex flex-col gap-2">
          <div style={{ height: CHART_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`mcOuter-${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={accentHex} stopOpacity={0.14} />
                    <stop offset={1} stopColor={accentHex} stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="step"
                  type="number"
                  domain={[0, mc.horizon ?? "dataMax"]}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(n: number) => `${n}`}
                />
                <YAxis
                  width={64}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)}
                />
                <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ stroke: "var(--color-border)" }}
                  content={({ active, payload }) => {
                    const r = payload?.[0]?.payload as Row | undefined;
                    if (!active || !r) return null;
                    return (
                      <TooltipShell title={`After ${r.step} trades`}>
                        <TooltipRow label="Simulated 95th pct" value={formatMoney(r.p95)} />
                        <TooltipRow label="Simulated 75th pct" value={formatMoney(r.p75)} />
                        <TooltipRow label="Simulated median" value={formatMoney(r.p50)} color={pnlColor(r.p50)} />
                        <TooltipRow label="Simulated 25th pct" value={formatMoney(r.p25)} />
                        <TooltipRow label="Simulated 5th pct" value={formatMoney(r.p5)} />
                        <TooltipRow label="Your actual path" value={formatMoney(r.historical)} color={pnlColor(r.historical)} />
                      </TooltipShell>
                    );
                  }}
                />
                <Area dataKey="outer" stroke="none" fill={`url(#mcOuter-${gid})`} isAnimationActive={animate} name="5th–95th percentile" />
                <Area dataKey="inner" stroke="none" fill={accentHex} fillOpacity={0.18} isAnimationActive={animate} name="25th–75th percentile" />
                <Line dataKey="p50" stroke={accentHex} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={animate} name="Median" />
                <Line dataKey="historical" stroke={histColor} strokeWidth={2} dot={false} isAnimationActive={animate} name="Your actual path" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Legend accent={accentHex} hist={histColor} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Chance of a net loss"
              value={fmtPct(mc.prob_loss)}
              hint={`Share of simulated paths whose cumulative P&L after ${mc.horizon} trades is below zero.`}
            />
            <Stat
              label="Median simulated P&L"
              value={mc.final_pnl ? formatMoney(mc.final_pnl.p50) : "—"}
              color={pnlColor(mc.final_pnl?.p50)}
              sub={mc.final_pnl ? `5–95%: ${formatMoney(mc.final_pnl.p5, { digits: 0 })} to ${formatMoney(mc.final_pnl.p95, { digits: 0 })}` : undefined}
              hint={`Middle simulated result after ${mc.horizon} trades. Your actual result over the same trades was ${formatMoney(mc.historical_final_pnl ?? 0)}.`}
            />
            <Stat
              label="Median simulated drawdown"
              value={mc.max_drawdown ? formatMoney(-mc.max_drawdown.p50) : "—"}
              color={PNL_LOSS_HEX}
              sub={mc.max_drawdown ? `1 in 20 paths: ${formatMoney(-mc.max_drawdown.p95, { digits: 0 })} or worse` : undefined}
              hint="Largest peak-to-trough fall within each simulated path, measured from 0 (the running peak includes the start)."
            />
            <Stat
              label="Your actual drawdown"
              value={mc.historical_max_drawdown != null ? formatMoney(-mc.historical_max_drawdown) : "—"}
              color={PNL_LOSS_HEX}
              sub="Historical, same trades"
              hint="Max drawdown of your real trade sequence over the simulated horizon, for comparison."
            />
          </div>
          {mc.drawdown_thresholds.length ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-[var(--color-text-muted)]">
              <span className="font-medium text-[var(--color-text-secondary)]">Simulated paths with a drawdown of at least</span>
              {mc.drawdown_thresholds.map((t) => (
                <span key={t.threshold_pct} className="tabular-nums">
                  {t.threshold_pct}% of start ({formatMoney(t.threshold_amount, { signed: false, digits: 0 })}):{" "}
                  <span className="font-semibold text-[var(--color-text-primary)]">{fmtPct(t.probability)}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="px-1 text-[11px] text-[var(--color-text-muted)]">
              Set a starting balance on this account to see drawdown probabilities as a % of the account.
            </p>
          )}
        </div>
      )}
    </InsightCard>
  );
}

function Legend({ accent, hist }: { accent: string; hist: string }) {
  const items = [
    { label: "5th–95th percentile (simulated)", swatch: <span className="h-2.5 w-4 rounded-sm" style={{ background: accent, opacity: 0.15 }} /> },
    { label: "25th–75th percentile (simulated)", swatch: <span className="h-2.5 w-4 rounded-sm" style={{ background: accent, opacity: 0.35 }} /> },
    { label: "Median (simulated)", swatch: <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: accent }} /> },
    { label: "Your actual cumulative P&L", swatch: <span className="h-0.5 w-4 rounded" style={{ background: hist }} /> },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[10px] text-[var(--color-text-muted)]">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          {i.swatch}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
