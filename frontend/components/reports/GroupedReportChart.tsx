"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Plus } from "lucide-react";

import { ChartOverflowMenu } from "@/components/reports/ChartOverflowMenu";
import { CompactSelect } from "@/components/reports/CompactSelect";
import { COUNT_SERIES_HEX, PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { formatAxisValue, formatMetricValue } from "@/lib/reports/format";
import {
  DIMENSION_METRICS,
  dimensionMetricLabel,
  metricValue,
  type DimensionMetricId,
  type GroupBucket,
} from "@/lib/reports/group";
import type { MoneyFormatter, ReportPnlMode, ReportValueType } from "@/lib/reports/types";

const AXIS = { fontSize: 10, fill: "var(--color-chart-axis)" } as const;
const CHART_H = 268;

function valueType(id: DimensionMetricId): ReportValueType {
  if (id === "pnl" || id === "avg_pnl") return "currency";
  if (id === "win_rate") return "percent";
  return "count";
}

function axisOf(id: DimensionMetricId): "money" | "count" | "percent" {
  return DIMENSION_METRICS.find((m) => m.id === id)?.axis ?? "count";
}

function colorOf(id: DimensionMetricId): string {
  if (id === "trade_count") return COUNT_SERIES_HEX;
  if (id === "win_rate") return PNL_PROFIT_HEX;
  return PNL_PROFIT_HEX;
}

function toRows(groups: GroupBucket[]) {
  const rows: Array<Record<string, number | string | null>> = [];
  for (let i = 0; i < groups.length; i++) {
    const curr = groups[i];
    const prev = groups[i - 1];
    if (prev && prev.pnl !== 0 && curr.pnl !== 0 && Math.sign(prev.pnl) !== Math.sign(curr.pnl)) {
      const t = prev.pnl / (prev.pnl - curr.pnl);
      rows.push({
        x: i - 1 + t,
        label: "",
        fullLabel: "",
        pnl: 0,
        pnlPos: 0,
        pnlNeg: 0,
        trade_count: null,
        win_rate: null,
        avg_pnl: null,
      });
    }
    rows.push({
      x: i,
      label: curr.label,
      fullLabel: curr.fullLabel,
      pnl: curr.pnl,
      pnlPos: curr.pnl >= 0 ? curr.pnl : null,
      pnlNeg: curr.pnl < 0 ? curr.pnl : null,
      trade_count: curr.trades,
      win_rate: metricValue(curr, "win_rate"),
      avg_pnl: metricValue(curr, "avg_pnl"),
    });
  }
  return rows;
}

function formatValue(id: DimensionMetricId, value: number, formatMoney: MoneyFormatter) {
  return formatMetricValue(value, valueType(id), formatMoney);
}

function GroupTooltip({
  active,
  payload,
  metrics,
  labels,
  formatMoney,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, unknown> }>;
  metrics: DimensionMetricId[];
  labels: Record<string, string>;
  formatMoney: MoneyFormatter;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || typeof row.fullLabel !== "string" || !row.fullLabel) return null;
  return (
    <div className="min-w-[176px] max-w-[240px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-dropdown)]">
      <p className="text-[11px] font-medium text-[var(--color-text-primary)]">{row.fullLabel}</p>
      {metrics.map((id) => {
        const raw = row[id];
        if (typeof raw !== "number") return null;
        const color = id === "pnl" || id === "avg_pnl" ? (raw < 0 ? PNL_LOSS_HEX : PNL_PROFIT_HEX) : colorOf(id);
        return (
          <p key={id} className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
            <span>
              {labels[id]}{" "}
              <span className="tabular-nums text-[var(--color-text-primary)]">{formatValue(id, raw, formatMoney)}</span>
            </span>
          </p>
        );
      })}
    </div>
  );
}

export function GroupedReportChart({
  groups,
  defaultMetrics,
  pnlMode,
  formatMoney,
}: {
  groups: GroupBucket[];
  defaultMetrics: DimensionMetricId[];
  pnlMode: ReportPnlMode;
  formatMoney: MoneyFormatter;
}) {
  const uid = useId().replace(/:/g, "");
  const [metrics, setMetrics] = useState<DimensionMetricId[]>(defaultMetrics);
  const [picking, setPicking] = useState(false);
  const rows = useMemo(() => toRows(groups), [groups]);
  const ticks = useMemo(() => groups.map((_, i) => i), [groups]);
  const labels = useMemo(
    () => Object.fromEntries(DIMENSION_METRICS.map((m) => [m.id, dimensionMetricLabel(m.id, pnlMode)])),
    [pnlMode]
  );

  const used = new Set(metrics);
  const addable = DIMENSION_METRICS.filter((m) => !used.has(m.id));
  const moneyIds = metrics.filter((id) => axisOf(id) === "money");
  const countIds = metrics.filter((id) => axisOf(id) === "count");
  const percentIds = metrics.filter((id) => axisOf(id) === "percent");
  const barOnly = percentIds.length > 0 && moneyIds.length === 0 && countIds.length === 0;
  const dual = moneyIds.length > 0 && (countIds.length > 0 || percentIds.length > 0);

  function replaceMetric(index: number, next: DimensionMetricId) {
    setMetrics((curr) => curr.map((id, i) => (i === index ? next : id)));
  }

  function addMetric(id: DimensionMetricId) {
    setMetrics((curr) => (curr.includes(id) || curr.length >= 3 ? curr : [...curr, id]));
    setPicking(false);
  }

  function removeLast() {
    setMetrics((curr) => (curr.length > 1 ? curr.slice(0, -1) : curr));
  }

  function reset() {
    setMetrics(defaultMetrics);
  }

  const optionsFor = (current: DimensionMetricId) =>
    DIMENSION_METRICS.filter((m) => m.id === current || !used.has(m.id)).map((m) => ({
      id: m.id,
      label: labels[m.id],
    }));

  const yTick = (id: DimensionMetricId) => (v: number) => formatAxisValue(Number(v), valueType(id), formatMoney);
  const xTick = (v: number) => groups[v]?.label ?? "";
  const showDots = groups.length > 1 && groups.length <= 48;
  const posFill = `gPos_${uid}`;
  const negFill = `gNeg_${uid}`;

  if (!groups.length) {
    return (
      <article className="dash-card flex h-full min-h-0 min-w-0 flex-col p-3.5">
        <div
          className="flex flex-1 items-center justify-center text-[12px] text-[var(--color-text-muted)]"
          style={{ minHeight: CHART_H }}
        >
          No trade data in this range
        </div>
      </article>
    );
  }

  return (
    <article className="dash-card flex h-full min-h-0 min-w-0 flex-col p-3.5">
      <header className="flex h-11 shrink-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <BarChart3 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          {metrics.map((id, i) => (
            <CompactSelect
              key={`${id}-${i}`}
              value={id}
              options={optionsFor(id)}
              onChange={(next) => replaceMetric(i, next)}
              ariaLabel={`Metric ${i + 1}`}
              width={150}
            />
          ))}
          {addable.length > 0 && metrics.length < 3 ? (
            picking ? (
              <CompactSelect
                value={addable[0].id}
                options={addable.map((m) => ({ id: m.id, label: labels[m.id] }))}
                onChange={addMetric}
                ariaLabel="Add metric"
                width={150}
              />
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="inline-flex h-8 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 text-[12px] font-medium text-primary outline-none hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add metric
              </button>
            )
          ) : null}
        </div>
        <ChartOverflowMenu
          canRemove={metrics.length > 1}
          onDuplicate={reset}
          onRemove={removeLast}
          duplicateLabel="Reset"
        />
      </header>

      <div className="w-full min-w-0 flex-1" style={{ minHeight: CHART_H, height: CHART_H }}>
        {barOnly ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.filter((r) => r.label)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={yTick(percentIds[0] ?? "win_rate")}
                domain={[0, (dataMax: number) => {
                  const max = Number(dataMax);
                  if (!Number.isFinite(max) || max <= 0) return 100;
                  return Math.max(10, Math.ceil(max / 10) * 10);
                }]}
              />
              <Tooltip
                cursor={{ fill: "rgba(20,20,30,0.04)" }}
                content={<GroupTooltip metrics={metrics} labels={labels} formatMoney={formatMoney} />}
              />
              {percentIds.map((id) => (
                <Bar
                  key={id}
                  dataKey={id}
                  name={labels[id]}
                  fill={PNL_PROFIT_HEX}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={posFill} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.42} />
                  <stop offset="55%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={PNL_PROFIT_HEX} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={negFill} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={PNL_LOSS_HEX} stopOpacity={0.36} />
                  <stop offset="100%" stopColor={PNL_LOSS_HEX} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tick={AXIS}
                tickLine={false}
                axisLine={false}
                minTickGap={20}
                tickFormatter={xTick}
              />
              {moneyIds.length > 0 ? (
                <YAxis
                  yAxisId="money"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={yTick(moneyIds[0])}
                />
              ) : (
                <YAxis
                  yAxisId="count"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={yTick(countIds[0] ?? "trade_count")}
                />
              )}
              {dual ? (
                <YAxis
                  yAxisId={countIds.length ? "count" : "percent"}
                  orientation="right"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={yTick(countIds[0] ?? percentIds[0] ?? "trade_count")}
                />
              ) : null}
              <ReferenceLine y={0} yAxisId={moneyIds.length ? "money" : "count"} stroke="var(--color-border)" />
              <Tooltip
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                content={<GroupTooltip metrics={metrics} labels={labels} formatMoney={formatMoney} />}
              />
              {(metrics.includes("pnl") ? ["pnl"] : []).map(() => (
                <Area
                  key="pnlPos"
                  yAxisId="money"
                  type="monotone"
                  dataKey="pnlPos"
                  stroke={PNL_PROFIT_HEX}
                  fill={`url(#${posFill})`}
                  strokeWidth={1.75}
                  dot={showDots ? { r: 2.25, fill: PNL_PROFIT_HEX, strokeWidth: 0 } : false}
                  activeDot={{ r: 3.5, fill: PNL_PROFIT_HEX, strokeWidth: 0 }}
                  name={labels.pnl}
                />
              ))}
              {metrics.includes("pnl") ? (
                <Area
                  yAxisId="money"
                  type="monotone"
                  dataKey="pnlNeg"
                  stroke={PNL_LOSS_HEX}
                  fill={`url(#${negFill})`}
                  strokeWidth={1.75}
                  dot={showDots ? { r: 2.25, fill: PNL_LOSS_HEX, strokeWidth: 0 } : false}
                  activeDot={{ r: 3.5, fill: PNL_LOSS_HEX, strokeWidth: 0 }}
                  name={labels.pnl}
                  legendType="none"
                />
              ) : null}
              {metrics.includes("avg_pnl") ? (
                <Line
                  yAxisId="money"
                  type="monotone"
                  dataKey="avg_pnl"
                  stroke={PNL_PROFIT_HEX}
                  strokeWidth={2}
                  dot={showDots ? { r: 2.25, fill: PNL_PROFIT_HEX, strokeWidth: 0 } : false}
                  name={labels.avg_pnl}
                  connectNulls
                />
              ) : null}
              {countIds.map((id) => (
                <Line
                  key={id}
                  yAxisId="count"
                  type="monotone"
                  dataKey={id}
                  stroke={COUNT_SERIES_HEX}
                  strokeWidth={2}
                  dot={showDots ? { r: 2.25, fill: COUNT_SERIES_HEX, strokeWidth: 0 } : false}
                  activeDot={{ r: 3.5, fill: COUNT_SERIES_HEX, strokeWidth: 0 }}
                  name={labels[id]}
                  connectNulls
                />
              ))}
              {percentIds.map((id) => (
                <Line
                  key={id}
                  yAxisId={countIds.length ? "count" : dual ? "percent" : moneyIds.length ? "money" : "count"}
                  type="monotone"
                  dataKey={id}
                  stroke={PNL_PROFIT_HEX}
                  strokeWidth={2}
                  dot={showDots ? { r: 2.25, fill: PNL_PROFIT_HEX, strokeWidth: 0 } : false}
                  name={labels[id]}
                  connectNulls
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <footer className="mt-1 flex h-7 shrink-0 flex-wrap items-center justify-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
        {metrics.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            {id === "pnl" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: PNL_PROFIT_HEX }} />
                <span className="-ml-1 h-1.5 w-1.5 rounded-full" style={{ background: PNL_LOSS_HEX }} />
              </>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(id) }} />
            )}
            {labels[id]}
          </span>
        ))}
      </footer>
    </article>
  );
}

export function GroupedChartPair({
  groups,
  pnlMode,
  formatMoney,
}: {
  groups: GroupBucket[];
  pnlMode: ReportPnlMode;
  formatMoney: MoneyFormatter;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <GroupedReportChart
        groups={groups}
        defaultMetrics={["pnl", "trade_count"]}
        pnlMode={pnlMode}
        formatMoney={formatMoney}
      />
      <GroupedReportChart
        groups={groups}
        defaultMetrics={["win_rate"]}
        pnlMode={pnlMode}
        formatMoney={formatMoney}
      />
    </div>
  );
}
