"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { BAR_LOSS_HEX, BAR_PROFIT_HEX, CHART_LINE_HEX, COUNT_SERIES_HEX } from "@/lib/appearance";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import { formatAxisCurrency } from "@/lib/reports/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { useDrill } from "../DrillContext";
import { BucketBars, useBucketMetric } from "../ui/BucketBars";
import { AXIS_TICK, ClickHint, GRID_STROKE, TooltipRow, TooltipShell } from "../ui/chart";
import { ComparisonList } from "../ui/ComparisonList";
import { InsightCard, InsufficientState, Stat } from "../ui/InsightCard";
import { Segmented } from "../ui/Segmented";

const BODY_H = 240;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_SHORT[Number(m) - 1]} ${y.slice(2)}`;
}

export function DisciplineSection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const d = data.discipline;
  const cb = d.clean_vs_broken;
  const [scoreKind, setScoreKind] = useState<"compliance" | "execution">("compliance");
  const bucketMetric = useBucketMetric("avg");
  const bucketRows = scoreKind === "compliance" ? d.compliance : d.execution;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <InsightCard
          title="Rules broken"
          caption={cb.clean_rate != null ? `${fmtPct(cb.clean_rate, 0)} of trades had no broken rule` : "Trades where a rule was broken"}
          hint="Each rule is compared with every trade where it was not broken. Click a rule to see its trades."
        >
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Stat label="Clean trades · avg" value={cb.clean.avg_pnl != null ? formatMoney(cb.clean.avg_pnl) : "—"} color={pnlColor(cb.clean.avg_pnl)} sub={`${cb.clean.trades} trades · ${fmtPct(cb.clean.win_rate, 0)} win`} />
            <Stat label="Rule broken · avg" value={cb.broken.avg_pnl != null ? formatMoney(cb.broken.avg_pnl) : "—"} color={pnlColor(cb.broken.avg_pnl)} sub={`${cb.broken.trades} trades · ${fmtPct(cb.broken.win_rate, 0)} win`} />
          </div>
          <ComparisonList
            block={d.rules}
            dimension="rule"
            drillTitle={(l) => `Trades where “${l}” was broken`}
            formatMoney={formatMoney}
            emptyReason="No broken rules logged in this range. Mark rules broken on trades to see what each one costs."
            height={BODY_H - 64}
          />
        </InsightCard>
        <ScoreRadar data={data} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <InsightCard
          title={scoreKind === "compliance" ? "Plan compliance" : "Execution score"}
          caption={
            scoreKind === "compliance"
              ? `${d.compliance_rated} trades rated for plan compliance (0–10)`
              : "Result by the trade's execution score (0–100)"
          }
          hint={scoreKind === "compliance" ? "Plan compliance is the 0–10 rating you gave the trade." : d.execution_note}
          actions={
            <>
              <Segmented
                value={scoreKind}
                onChange={setScoreKind}
                ariaLabel="Score type"
                options={[
                  { id: "compliance", label: "Compliance" },
                  { id: "execution", label: "Execution" },
                ]}
              />
              {bucketMetric.control}
            </>
          }
        >
          {scoreKind === "compliance" && !d.compliance_rated ? (
            <InsufficientState reason="Rate plan compliance on trades (0–10) to see whether following your plan pays." height={BODY_H} />
          ) : (
            <BucketBars
              rows={bucketRows}
              metric={bucketMetric.metric}
              dimension={scoreKind}
              drillTitle={(r) => `${scoreKind === "compliance" ? "Compliance" : "Execution score"} ${r.label}`}
              formatMoney={formatMoney}
              height={BODY_H}
            />
          )}
        </InsightCard>
        <CheckinsCard data={data} formatMoney={formatMoney} />
      </div>

      <ProcessByMonth data={data} formatMoney={formatMoney} />
    </div>
  );
}

function ScoreRadar({ data }: { data: AdvancedAnalytics }) {
  const { accentHex } = useAppearance();
  const dims = data.discipline.score_dimensions;
  const rated = Math.max(0, ...dims.map((x) => x.rated_trades));
  const prevRated = Math.max(0, ...dims.map((x) => x.previous_rated_trades));
  const rows = dims.map((x) => ({ ...x, cur: x.avg ?? 0, prev: x.previous_avg ?? 0 }));
  return (
    <InsightCard
      title="Self-rating profile"
      caption={rated ? `Average 1–10 ratings across ${rated} rated trades${prevRated ? " · dashed = previous period" : ""}` : "Your 1–10 trade ratings"}
      hint="Averages of the preparation, risk, entry, exit, discipline, and psychology ratings you gave each trade."
    >
      {!rated ? (
        <InsufficientState reason="Rate trades on preparation, risk, entry, exit, discipline, and psychology to build your profile." height={BODY_H + 16} />
      ) : (
        <div style={{ height: BODY_H + 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={rows} outerRadius="72%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
              <PolarGrid stroke="var(--color-border)" />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }} />
              {prevRated ? (
                <Radar dataKey="prev" stroke="var(--color-text-muted)" strokeDasharray="4 3" fill="none" isAnimationActive={!prefersReducedMotion()} />
              ) : null}
              <Radar dataKey="cur" stroke={accentHex} fill={accentHex} fillOpacity={0.18} strokeWidth={1.75} isAnimationActive={!prefersReducedMotion()} />
              <Tooltip
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !r) return null;
                  return (
                    <TooltipShell title={r.label}>
                      <TooltipRow label="This period" value={r.avg != null ? `${r.avg.toFixed(1)} / 10 (${r.rated_trades})` : "Not rated"} />
                      <TooltipRow label="Previous" value={r.previous_avg != null ? `${r.previous_avg.toFixed(1)} / 10 (${r.previous_rated_trades})` : "—"} />
                    </TooltipShell>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </InsightCard>
  );
}

function CheckinsCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const rows = data.discipline.checkins;
  const hasCheckins = rows.some((r) => r.key !== "none" && r.days > 0);
  return (
    <InsightCard
      title="Daily check-ins"
      caption="Average day result by whether you followed your plan that day"
      hint="Uses your end-of-day check-in for each trading day (account-specific or all accounts). Days with trades but no check-in are shown separately."
    >
      {!hasCheckins ? (
        <InsufficientState reason="Complete daily check-ins to compare days you followed your plan with days you didn't." height={BODY_H} />
      ) : (
        <div style={{ height: BODY_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 6, right: 4, bottom: 0, left: -6 }}
              onClick={(e) => {
                const r = e?.activePayload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (r?.trades) drill({ dimension: "checkin", key: r.key }, `Trades on days: ${r.label}`);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)} />
              <ReferenceLine y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ fill: "var(--color-surface-secondary)" }}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !r) return null;
                  return (
                    <TooltipShell title={r.label}>
                      <TooltipRow label="Trading days" value={r.days} />
                      <TooltipRow label="Avg day" value={r.avg_day_pnl != null ? formatMoney(r.avg_day_pnl) : "—"} color={pnlColor(r.avg_day_pnl)} />
                      <TooltipRow label="Green days" value={fmtPct(r.green_day_pct, 0)} />
                      <TooltipRow label="Total" value={formatMoney(r.net_pnl)} color={pnlColor(r.net_pnl)} />
                      {r.trades ? <ClickHint /> : null}
                    </TooltipShell>
                  );
                }}
              />
              <Bar dataKey="avg_day_pnl" radius={[3, 3, 0, 0]} maxBarSize={48} isAnimationActive={!prefersReducedMotion()}>
                {rows.map((r) => (
                  <Cell key={r.key} fill={(r.avg_day_pnl ?? 0) >= 0 ? BAR_PROFIT_HEX : BAR_LOSS_HEX} fillOpacity={r.days ? 1 : 0.25} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </InsightCard>
  );
}

function ProcessByMonth({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const rows = data.discipline.process_by_month.map((r) => ({ ...r, label: monthLabel(r.key) }));
  const animate = !prefersReducedMotion();
  return (
    <InsightCard
      title="Process vs results by month"
      caption="Bars: monthly P&L · lines: avg execution score, avg self-rating, and % of trades with a broken rule (0–100)"
      hint={`${data.discipline.execution_note} Self-rating = average of your 1–10 ratings × 10. Click a month to see its trades.`}
    >
      {!rows.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={BODY_H} />
      ) : (
        <div style={{ height: BODY_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 6, right: 4, bottom: 0, left: -6 }}
              onClick={(e) => {
                const r = e?.activePayload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (r) drill({ dimension: "month", key: r.key }, `Trades closed in ${r.label}`);
              }}
              className="cursor-pointer"
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis yAxisId="pnl" tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(n: number) => formatAxisCurrency(n, formatMoney)} />
              <YAxis yAxisId="score" orientation="right" domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} />
              <ReferenceLine yAxisId="pnl" y={0} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ fill: "var(--color-surface-secondary)" }}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                  if (!active || !r) return null;
                  return (
                    <TooltipShell title={r.label}>
                      <TooltipRow label="P&L" value={formatMoney(r.net_pnl)} color={pnlColor(r.net_pnl)} />
                      <TooltipRow label="Trades" value={r.trades} />
                      <TooltipRow label="Avg execution" value={`${r.avg_execution.toFixed(0)} / 100`} />
                      <TooltipRow label="Avg self-rating" value={r.avg_health != null ? `${r.avg_health.toFixed(0)} / 100` : "Not rated"} />
                      <TooltipRow label="Rule broken" value={fmtPct(r.rule_break_pct, 0)} />
                      <ClickHint />
                    </TooltipShell>
                  );
                }}
              />
              <Bar yAxisId="pnl" dataKey="net_pnl" radius={[3, 3, 0, 0]} maxBarSize={32} isAnimationActive={animate}>
                {rows.map((r) => (
                  <Cell key={r.key} fill={r.net_pnl >= 0 ? BAR_PROFIT_HEX : BAR_LOSS_HEX} />
                ))}
              </Bar>
              <Line yAxisId="score" dataKey="avg_execution" stroke={CHART_LINE_HEX} strokeWidth={1.75} dot={{ r: 2 }} isAnimationActive={animate} />
              <Line yAxisId="score" dataKey="avg_health" stroke={COUNT_SERIES_HEX} strokeWidth={1.5} dot={{ r: 2 }} connectNulls isAnimationActive={animate} />
              <Line yAxisId="score" dataKey="rule_break_pct" stroke={BAR_LOSS_HEX} strokeDasharray="4 3" strokeWidth={1.25} dot={false} isAnimationActive={animate} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <ul className="mt-1.5 flex flex-wrap gap-x-4 px-1 text-[10px] text-[var(--color-text-muted)]">
        <li className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: CHART_LINE_HEX }} />Avg execution</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: COUNT_SERIES_HEX }} />Avg self-rating</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed" style={{ borderColor: BAR_LOSS_HEX }} />% trades with a broken rule</li>
      </ul>
    </InsightCard>
  );
}
