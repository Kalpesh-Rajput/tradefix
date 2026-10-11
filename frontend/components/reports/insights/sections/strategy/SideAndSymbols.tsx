"use client";

import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BAR_LOSS_HEX, BAR_PROFIT_HEX, CHART_LINE_HEX } from "@/lib/appearance";
import { fmtPct, fmtRatio, pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { AdvancedAnalytics, SymbolRow } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { useDrill } from "../../DrillContext";
import { AXIS_TICK, CHART_H, ClickHint, GRID_STROKE, TooltipRow, TooltipShell } from "../../ui/chart";
import { InsightCard, InsufficientState } from "../../ui/InsightCard";

export function LongShortCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const sides = data.strategy.sides;
  const total = sides.reduce((a, s) => a + s.trades, 0);
  return (
    <InsightCard title="Long vs short" caption="Same metrics, split by direction" hint="Click a side to see its trades.">
      {!sides.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={CHART_H} />
      ) : (
        <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {sides.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => drill({ dimension: "side", key: s.key }, `${s.label} trades`)}
              className="flex flex-col rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] p-3 text-left outline-none transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{s.label}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{total ? Math.round((s.trades / total) * 100) : 0}% of trades</span>
              </div>
              <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight" style={{ color: pnlColor(s.net_pnl) }}>
                {formatMoney(s.net_pnl)}
              </p>
              <dl className="mt-2 space-y-1 text-[11px]">
                {[
                  ["Trades", String(s.trades)],
                  ["Win rate", fmtPct(s.win_rate)],
                  ["Profit factor", fmtRatio(s.profit_factor)],
                  ["Expectancy", s.avg_pnl != null ? formatMoney(s.avg_pnl) : "—"],
                  ["Payoff", s.payoff != null ? `${fmtRatio(s.payoff)}×` : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-[var(--color-text-muted)]">{k}</dt>
                    <dd className="font-medium tabular-nums text-[var(--color-text-primary)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </button>
          ))}
        </div>
      )}
    </InsightCard>
  );
}

export function SymbolParetoCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const { symbols, symbols_other, symbol_count, profitable_symbols } = data.strategy;
  const animate = !prefersReducedMotion();
  return (
    <InsightCard
      title="Symbol concentration"
      caption={`${profitable_symbols} of ${symbol_count} symbols profitable${
        symbols_other ? ` · ${symbols_other.symbols} smaller symbols (${formatMoney(symbols_other.net_pnl, { digits: 0 })}) not shown` : ""
      }`}
      hint="Bars: P&L by symbol, best to worst. Line: running share of your total profit from profitable symbols — a steep start means a few symbols carry your results."
    >
      {!symbols.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={CHART_H} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2" style={{ height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={symbols}
              margin={{ top: 6, right: 4, bottom: 0, left: -6 }}
              onClick={(e) => {
                const s = e?.activePayload?.[0]?.payload as SymbolRow | undefined;
                if (s) drill({ dimension: "symbol", key: s.key }, `${s.label} trades`);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={44} />
              <YAxis yAxisId="pnl" tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)} />
              <YAxis yAxisId="share" orientation="right" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} tickFormatter={(n: number) => `${n}%`} />
              <ReferenceLine yAxisId="pnl" y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ fill: "var(--color-surface-secondary)" }}
                content={({ active, payload }) => {
                  const s = payload?.[0]?.payload as SymbolRow | undefined;
                  if (!active || !s) return null;
                  return (
                    <TooltipShell title={s.label}>
                      <TooltipRow label="P&L" value={formatMoney(s.net_pnl)} color={pnlColor(s.net_pnl)} />
                      <TooltipRow label="Trades" value={s.trades} />
                      <TooltipRow label="Win rate" value={fmtPct(s.win_rate)} />
                      {s.share_of_profit_pct != null ? <TooltipRow label="Share of profit" value={fmtPct(s.share_of_profit_pct)} /> : null}
                      <ClickHint />
                    </TooltipShell>
                  );
                }}
              />
              <Bar yAxisId="pnl" dataKey="net_pnl" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={animate}>
                {symbols.map((s) => (
                  <Cell key={s.key} fill={s.net_pnl >= 0 ? BAR_PROFIT_HEX : BAR_LOSS_HEX} />
                ))}
              </Bar>
              <Line
                yAxisId="share"
                dataKey="cumulative_share_pct"
                stroke={CHART_LINE_HEX}
                strokeWidth={1.5}
                dot={{ r: 2.5 }}
                connectNulls={false}
                isAnimationActive={animate}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: CHART_H }}>
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[var(--color-surface)]">
              <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
                <th className="py-1.5 text-left font-medium">Symbol</th>
                <th className="py-1.5 text-right font-medium">Trades</th>
                <th className="py-1.5 text-right font-medium">Win %</th>
                <th className="py-1.5 text-right font-medium">P&L</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((s) => (
                <tr
                  key={s.key}
                  tabIndex={0}
                  onClick={() => drill({ dimension: "symbol", key: s.key }, `${s.label} trades`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      drill({ dimension: "symbol", key: s.key }, `${s.label} trades`);
                    }
                  }}
                  className="cursor-pointer border-b border-[var(--color-border-subtle)] outline-none last:border-0 hover:bg-[var(--color-surface-secondary)] focus-visible:bg-[var(--color-primary-very-light)]"
                >
                  <td className="max-w-[110px] truncate py-1.5 font-semibold text-[var(--color-text-primary)]">{s.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{s.trades}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmtPct(s.win_rate, 0)}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: pnlColor(s.net_pnl) }}>
                    {formatMoney(s.net_pnl, { digits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </InsightCard>
  );
}
