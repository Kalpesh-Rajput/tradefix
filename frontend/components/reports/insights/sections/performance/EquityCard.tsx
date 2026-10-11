"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { fmtIsoDate, fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { AdvancedAnalytics, EquityPoint } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { useDrill } from "../../DrillContext";
import { AXIS_TICK, ClickHint, GRID_STROKE, TooltipRow, TooltipShell } from "../../ui/chart";
import { InsightCard, InsufficientState } from "../../ui/InsightCard";
import { Segmented } from "../../ui/Segmented";

type Basis = "equity" | "pnl";

const TOP_H = 220;
const UNDER_H = 96;

export function EquityCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const gid = useId().replace(/:/g, "");
  const drill = useDrill();
  const [basis, setBasis] = useState<Basis>("equity");
  const eq = data.performance.equity;
  const animate = !prefersReducedMotion();

  const series = useMemo(
    () => [
      { index: 0, date: "", trade_id: "", pnl: 0, cumulative_pnl: 0, equity: eq.starting_balance, drawdown: 0, drawdown_pct: 0 },
      ...eq.points,
    ],
    [eq]
  );
  const key = basis === "equity" ? "equity" : "cumulative_pnl";
  const baseline = basis === "equity" ? eq.starting_balance : 0;
  const values = series.map((p) => p[key]);
  const max = Math.max(...values, baseline);
  const min = Math.min(...values, baseline);
  const offset = max === min ? 1 : (max - baseline) / (max - min);
  const last = eq.points[eq.points.length - 1];

  const onPointClick = (p: EquityPoint | undefined) => {
    if (p?.date) drill({ dimension: "day", key: p.date }, `Trades closed ${fmtIsoDate(p.date)}`);
  };

  return (
    <InsightCard
      title="Equity & drawdown"
      caption={
        eq.points.length
          ? `Realized equity from ${formatMoney(eq.starting_balance, { signed: false })} · ${eq.total_points.toLocaleString()} closed trades`
          : "Realized equity from closed trades"
      }
      hint={data.meta.equity_note}
      actions={
        <Segmented<Basis>
          value={basis}
          onChange={setBasis}
          ariaLabel="Equity basis"
          options={[
            { id: "equity", label: "Equity" },
            { id: "pnl", label: "Cumulative P&L" },
          ]}
        />
      }
    >
      {!eq.points.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={TOP_H + UNDER_H} />
      ) : (
        <div className="flex flex-col">
          <div style={{ height: TOP_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series}
                syncId={`eq-${gid}`}
                margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
                onClick={(e) => onPointClick(e?.activePayload?.[0]?.payload as EquityPoint | undefined)}
                className="cursor-pointer"
              >
                <defs>
                  <linearGradient id={`eqFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={PNL_PROFIT_HEX} stopOpacity={0.28} />
                    <stop offset={offset} stopColor={PNL_PROFIT_HEX} stopOpacity={0.04} />
                    <stop offset={offset} stopColor={PNL_LOSS_HEX} stopOpacity={0.04} />
                    <stop offset={1} stopColor={PNL_LOSS_HEX} stopOpacity={0.28} />
                  </linearGradient>
                  <linearGradient id={`eqStroke-${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={offset} stopColor={PNL_PROFIT_HEX} />
                    <stop offset={offset} stopColor={PNL_LOSS_HEX} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="index" hide />
                <YAxis
                  width={64}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                  tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)}
                />
                <ReferenceLine y={baseline} stroke="var(--color-border)" strokeDasharray="3 3" />
                <Tooltip
                  cursor={{ stroke: "var(--color-border)" }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as EquityPoint | undefined;
                    if (!active || !p || !p.index) return null;
                    return (
                      <TooltipShell title={`Trade #${p.index} · ${fmtIsoDate(p.date)}`}>
                        <TooltipRow label="Trade P&L" value={formatMoney(p.pnl)} color={pnlColor(p.pnl)} />
                        <TooltipRow label="Cumulative P&L" value={formatMoney(p.cumulative_pnl)} color={pnlColor(p.cumulative_pnl)} />
                        <TooltipRow label="Realized equity" value={formatMoney(p.equity, { signed: false })} />
                        <TooltipRow
                          label="Drawdown"
                          value={p.drawdown ? `${formatMoney(p.drawdown)} (${fmtPct(p.drawdown_pct)})` : "At peak"}
                          color={p.drawdown ? PNL_LOSS_HEX : undefined}
                        />
                        <ClickHint />
                      </TooltipShell>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={key}
                  stroke={`url(#eqStroke-${gid})`}
                  strokeWidth={1.75}
                  fill={`url(#eqFill-${gid})`}
                  baseValue={baseline}
                  isAnimationActive={animate}
                  animationDuration={900}
                  activeDot={{ r: 3.5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex items-center justify-between px-1 text-[10px] text-[var(--color-text-muted)]">
            <span>Underwater (distance below the previous equity peak)</span>
            {last ? (
              <span className="tabular-nums">
                Now {last.drawdown ? formatMoney(last.drawdown) : "at peak"} · max {formatMoney(-data.summary.max_drawdown)}
              </span>
            ) : null}
          </div>
          <div style={{ height: UNDER_H }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} syncId={`eq-${gid}`} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`ddFill-${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset={0} stopColor={PNL_LOSS_HEX} stopOpacity={0.05} />
                    <stop offset={1} stopColor={PNL_LOSS_HEX} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="index" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={32} />
                <YAxis
                  width={64}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  domain={["dataMin", 0]}
                  tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)}
                />
                <Tooltip content={() => null} cursor={{ stroke: "var(--color-border)" }} />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke={PNL_LOSS_HEX}
                  strokeWidth={1.25}
                  fill={`url(#ddFill-${gid})`}
                  isAnimationActive={animate}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </InsightCard>
  );
}
