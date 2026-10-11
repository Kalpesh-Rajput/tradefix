"use client";

import { CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { fmtDuration, pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { WeekdayHourHeatmap } from "./timing/WeekdayHourHeatmap";
import { BucketBars, useBucketMetric } from "../ui/BucketBars";
import { AXIS_TICK, CHART_H, GRID_STROKE, TooltipRow, TooltipShell } from "../ui/chart";
import { InsightCard, InsufficientState } from "../ui/InsightCard";

export function TimingSection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const t = data.timing;
  const sessions = useBucketMetric("net");
  const holds = useBucketMetric("avg");
  const holdRows = t.hold_buckets.filter((b) => b.trades > 0);
  const scatter = t.hold_scatter.filter((p) => p.seconds > 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <WeekdayHourHeatmap data={data} formatMoney={formatMoney} />
        </div>
        <div className="lg:col-span-4">
          <InsightCard
            title="Sessions"
            caption="Trade session, or the UTC entry hour when no session is set"
            hint="Asia 00–07 UTC, London 07–12, London/NY overlap 12–16, New York 16–21, Off-hours 21–24. A session saved on the trade takes priority."
            actions={sessions.control}
          >
            {!t.sessions.length ? (
              <InsufficientState reason="No closed trades in this range yet." height={CHART_H} />
            ) : (
              <BucketBars
                rows={t.sessions}
                metric={sessions.metric}
                dimension="session"
                drillTitle={(r) => `${r.label} session trades`}
                formatMoney={formatMoney}
                height={CHART_H}
                layout="horizontal-bars"
              />
            )}
          </InsightCard>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <InsightCard
          title="Holding time"
          caption={t.missing_hold ? `${t.missing_hold} trades without an exit time are excluded` : "Result by how long trades were held"}
          hint="Hold time = exit time − entry time. Click a bar to see the trades."
          actions={holds.control}
        >
          {!holdRows.length ? (
            <InsufficientState reason="No trades with both entry and exit times in this range." height={CHART_H} />
          ) : (
            <BucketBars
              rows={holdRows}
              metric={holds.metric}
              dimension="hold"
              drillTitle={(r) => `Trades held ${r.label}`}
              formatMoney={formatMoney}
              height={CHART_H}
            />
          )}
        </InsightCard>

        <InsightCard
          title="Hold time vs result"
          caption={
            t.hold_scatter_total > scatter.length
              ? `Showing ${scatter.length} of ${t.hold_scatter_total} trades (evenly sampled) · log time scale`
              : `${scatter.length} trades · log time scale`
          }
          hint="Each dot is one trade. Look for whether winners and losers cluster at different hold times — for example cutting winners early or holding losers too long."
        >
          {!scatter.length ? (
            <InsufficientState reason="No trades with both entry and exit times in this range." height={CHART_H} />
          ) : (
            <div style={{ height: CHART_H }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 6, right: 8, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke={GRID_STROKE} />
                  <XAxis
                    type="number"
                    dataKey="seconds"
                    scale="log"
                    domain={["auto", "auto"]}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(n: number) => fmtDuration(n)}
                  />
                  <YAxis
                    type="number"
                    dataKey="pnl"
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={58}
                    tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)}
                  />
                  <ReferenceLine y={0} stroke="var(--color-border)" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as (typeof scatter)[number] | undefined;
                      if (!active || !p) return null;
                      return (
                        <TooltipShell title={p.symbol}>
                          <TooltipRow label="Held" value={fmtDuration(p.seconds)} />
                          <TooltipRow label="P&L" value={formatMoney(p.pnl)} color={pnlColor(p.pnl)} />
                        </TooltipShell>
                      );
                    }}
                  />
                  <Scatter data={scatter} isAnimationActive={!prefersReducedMotion()}>
                    {scatter.map((p) => (
                      <Cell key={p.id} fill={p.pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX} fillOpacity={0.65} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </InsightCard>
      </div>
    </div>
  );
}
