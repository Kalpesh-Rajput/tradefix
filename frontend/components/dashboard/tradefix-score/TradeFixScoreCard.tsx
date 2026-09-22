"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { CHART_BODY_H, ChartCard } from "@/components/dashboard/zella/ChartCard";
import {
  TradeFixScoreDetails,
  TradeFixScoreInfo,
} from "@/components/dashboard/tradefix-score/TradeFixScoreDetails";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import {
  SCORE_METRIC_LABEL,
  SCORE_METRIC_ORDER,
  SCORE_METRIC_SHORT,
  prefersReducedMotion,
  scoreBand,
} from "@/lib/tradefix-score/labels";
import type { TradeFixScoreMetricKey, TradeFixScoreResult } from "@/lib/types";

function useCountUp(target: number | null, duration = 700) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (target == null) {
      setValue(null);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

function RadarAxisTick({
  x = 0,
  y = 0,
  cx,
  cy,
  payload,
}: {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value?: string };
}) {
  const label = payload?.value;
  if (!label) return null;
  let tx = x;
  let ty = y;
  let anchor: "start" | "middle" | "end" = "middle";
  if (cx != null && cy != null) {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    tx = cx + (dx / dist) * (dist + 12);
    ty = cy + (dy / dist) * (dist + 12);
    anchor = dx > 12 ? "start" : dx < -12 ? "end" : "middle";
  }
  return (
    <text
      x={tx}
      y={ty}
      textAnchor={anchor}
      dominantBaseline="central"
      fill="var(--color-text-secondary)"
      fontSize={10}
      fontWeight={500}
    >
      {label}
    </text>
  );
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: { fullName: string; score: number; actual: string; definition: string } }[];
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-[11px] shadow-[var(--shadow-dropdown)]">
      <p className="font-semibold text-[var(--color-text-primary)]">{row.fullName}</p>
      <p className="mt-1 tabular-nums text-[var(--color-text-secondary)]">
        Score <span className="font-semibold text-[var(--color-text-primary)]">{row.score.toFixed(0)} / 100</span>
      </p>
      <p className="tabular-nums text-[var(--color-text-secondary)]">
        Actual <span className="font-semibold text-[var(--color-text-primary)]">{row.actual}</span>
      </p>
      <p className="mt-1 max-w-[180px] text-[10px] leading-snug text-[var(--color-text-muted)]">{row.definition}</p>
    </div>
  );
}

export function TradeFixScoreCard({
  score,
  formatMoney,
}: {
  score: TradeFixScoreResult | null | undefined;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { accentHex } = useAppearance();
  const titleId = useId();
  const [infoOpen, setInfoOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [focusKey, setFocusKey] = useState<TradeFixScoreMetricKey | null>(null);

  const overall = score?.overall_score ?? null;
  const animated = useCountUp(overall);
  const band = scoreBand(overall);
  const sample = score?.sample_size ?? 0;

  const radarData = useMemo(() => {
    if (!score?.metrics) return [];
    return SCORE_METRIC_ORDER.map((key) => {
      const metric = score.metrics[key];
      return {
        metric: SCORE_METRIC_SHORT[key],
        fullName: SCORE_METRIC_LABEL[key],
        key,
        score: metric?.score ?? 0,
        actual: metric?.display ?? "—",
        definition: metric?.definition ?? "",
      };
    });
  }, [score]);

  const reduceMotion = prefersReducedMotion();
  const insight = score?.insights.find((i) => i.kind === "attention") ?? score?.insights[0];

  return (
    <ChartCard
      title="TradeFix Score"
      headerRight={
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-background)] hover:text-[var(--color-text-primary)]"
          aria-label="How TradeFix Score works"
        >
          <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      }
    >
      <div className="flex min-h-0 w-full min-w-0 flex-col" style={{ height: CHART_BODY_H }} id={titleId}>
        {!score || sample <= 0 || overall == null ? (
          <div className="flex h-full flex-col justify-center px-1">
            <p className="text-[22px] font-semibold tabular-nums text-[var(--color-text-muted)]">—</p>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">Not enough trading data yet.</p>
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Complete a few closed trades to generate your performance profile.
            </p>
          </div>
        ) : (
          <div className="grid h-full min-h-0 grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col">
              <p className="text-[26px] font-semibold leading-none tabular-nums tracking-tight text-[var(--color-text-primary)]">
                {(animated ?? overall).toFixed(1)}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                Performance profile
              </p>
              <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${Math.max(2, overall)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-text-secondary)]">
                {score.confidence.label}
                {score.confidence.level === "low" || score.confidence.level === "insufficient"
                  ? " · Low confidence"
                  : score.confidence.level === "high"
                    ? " · High confidence"
                    : ""}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Based on {sample} closed trades</p>
              {score.previous_delta != null ? (
                <p
                  className={`mt-1 text-[11px] font-medium tabular-nums ${
                    score.previous_delta >= 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-danger)]"
                  }`}
                >
                  {score.previous_delta >= 0 ? "↑" : "↓"} {Math.abs(score.previous_delta).toFixed(1)} vs previous period
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Not enough historical data</p>
              )}
              <p className="mt-auto line-clamp-2 text-[10px] leading-snug text-[var(--color-text-tertiary)]">
                {insight?.text}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFocusKey(null);
                  setDetailsOpen(true);
                }}
                className="mt-1 self-start text-[11px] font-semibold text-[var(--color-primary)]"
              >
                View breakdown
              </button>
            </div>
            <div className="min-h-0 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={radarData}
                  cx="50%"
                  cy="50%"
                  outerRadius="68%"
                  margin={{ top: 22, right: 22, bottom: 22, left: 22 }}
                >
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <PolarAngleAxis dataKey="metric" tick={<RadarAxisTick />} tickLine={false} />
                  <Radar
                    dataKey="score"
                    stroke={accentHex}
                    fill={accentHex}
                    fillOpacity={0.16}
                    strokeWidth={1.75}
                    dot={{ r: 2.5, fill: accentHex, strokeWidth: 0 }}
                    isAnimationActive={!reduceMotion}
                    animationDuration={700}
                  />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {infoOpen ? (
        <TradeFixScoreInfo
          onClose={() => setInfoOpen(false)}
          onViewDetails={() => {
            setInfoOpen(false);
            setFocusKey(null);
            setDetailsOpen(true);
          }}
        />
      ) : null}
      {detailsOpen && score ? (
        <TradeFixScoreDetails
          score={score}
          formatMoney={formatMoney}
          focusKey={focusKey}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}

      <span className="sr-only">
        {overall == null
          ? "TradeFix Score unavailable. Not enough closed trades."
          : `TradeFix Score ${overall.toFixed(1)} out of 100. ${score?.confidence.label}. Based on ${sample} closed trades. ${band.label} performance profile.`}
      </span>
    </ChartCard>
  );
}

export { TradeFixScoreCard as ZellaScoreCard };
