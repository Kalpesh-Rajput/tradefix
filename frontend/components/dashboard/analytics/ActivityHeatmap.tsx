"use client";

import { useMemo, useRef, useState } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import type { DashboardPerformance, HeatmapDay } from "@/lib/types";

import { AnalyticsEmpty, formatPct, tradeLabel, type MoneyFormat } from "./shared";

const PROFIT = ["#E7F6EE", "#B7E4C7", "#74C69D", "#2D9F6F", "#1B7A4E"];
const LOSS = ["#FDECEC", "#F6C1C1", "#EE8B8B", "#E15B5B", "#C63636"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GAP = 3;
const MONTH_H = 16;
const LABEL_COL = "2.25rem";

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function formatDay(iso: string): string {
  return fromIso(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function cellColor(day: HeatmapDay | undefined, maxAbs: number): string {
  if (!day || day.trades <= 0 || day.pnl == null) return "var(--color-border-subtle)";
  if (day.pnl === 0) return "var(--color-breakeven)";
  const ratio = maxAbs > 0 ? Math.min(1, Math.abs(day.pnl) / maxAbs) : 1;
  const level = ratio > 0.8 ? 4 : ratio > 0.6 ? 3 : ratio > 0.4 ? 2 : ratio > 0.2 ? 1 : 0;
  return day.pnl > 0 ? PROFIT[level] : LOSS[level];
}

export function ActivityHeatmap({
  data,
  formatMoney,
}: {
  data: DashboardPerformance;
  formatMoney: MoneyFormat;
}) {
  const { t } = useLocale();
  const heatmap = data.heatmap;
  const byDate = useMemo(() => new Map(heatmap.days.map((day) => [day.date, day])), [heatmap.days]);
  const weeks = useMemo(() => {
    const start = fromIso(heatmap.start);
    start.setDate(start.getDate() - start.getDay());
    const end = heatmap.end;
    const columns: string[][] = [];
    let cursor = toIso(start);
    while (cursor <= end) {
      columns.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
      cursor = addDays(cursor, 7);
    }
    return columns;
  }, [heatmap.start, heatmap.end]);
  const monthLabels = useMemo(
    () =>
      weeks.map((week, index) => {
        const first = week.find((iso) => iso >= heatmap.start && iso <= heatmap.end);
        if (!first) return "";
        const prev = index > 0 ? weeks[index - 1].find((iso) => iso >= heatmap.start) : null;
        if (prev && fromIso(prev).getMonth() === fromIso(first).getMonth()) return "";
        return fromIso(first).toLocaleDateString(undefined, { month: "short" });
      }),
    [weeks, heatmap.start, heatmap.end]
  );
  const maxAbs = useMemo(
    () => Math.max(0, ...heatmap.days.map((day) => Math.abs(day.pnl ?? 0))),
    [heatmap.days]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    iso: string;
    left: number;
    top: number;
    height: number;
    above: boolean;
  } | null>(null);
  const activeDay = tip ? byDate.get(tip.iso) : undefined;
  const outsideActive = tip != null && (tip.iso < heatmap.range_start || tip.iso > heatmap.range_end);

  function placeTip(iso: string, element: HTMLElement) {
    const wrap = wrapRef.current?.getBoundingClientRect();
    const cell = element.getBoundingClientRect();
    if (!wrap) return;
    const top = cell.top - wrap.top;
    const rawLeft = cell.left - wrap.left + cell.width / 2;
    setTip({
      iso,
      left: Math.min(Math.max(rawLeft, 64), Math.max(64, wrap.width - 64)),
      top,
      height: cell.height,
      above: top > 52,
    });
  }

  return (
    <ChartCard
      title={`${t("dashboard.activityHeatmap")} (Past Year)`}
      hint={t("dashboard.hint.activityHeatmap")}
    >
      {!data.has_trades ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.heatmap")} />
      ) : (
        <div ref={wrapRef} className="relative min-w-0" onMouseLeave={() => setTip(null)}>
          <div className="heatmap-scroll min-w-0 overflow-x-auto overflow-y-hidden" onScroll={() => setTip(null)}>
            <div
              className="grid w-full"
              style={{
                gridTemplateColumns: `${LABEL_COL} repeat(${weeks.length}, minmax(0, 1fr))`,
                gridTemplateRows: `${MONTH_H}px repeat(7, auto)`,
                columnGap: GAP,
                rowGap: GAP,
                minWidth: `calc(${LABEL_COL} + ${weeks.length} * 14px)`,
              }}
            >
              <span className="sticky left-0 z-10 bg-[var(--color-surface)]" style={{ gridColumn: 1, gridRow: 1 }} />
              {monthLabels.map((label, index) => (
                <span
                  key={weeks[index]?.[0] ?? index}
                  className="overflow-visible whitespace-nowrap text-[10px] leading-4 text-[var(--color-text-muted)]"
                  style={{ gridColumn: index + 2, gridRow: 1 }}
                >
                  {label}
                </span>
              ))}
              {DAY_NAMES.map((name, row) => (
                <span
                  key={name}
                  className="sticky left-0 z-10 flex items-center bg-[var(--color-surface)] text-[11px] font-medium leading-none text-[var(--color-text-secondary)]"
                  style={{ gridColumn: 1, gridRow: row + 2 }}
                >
                  {name}
                </span>
              ))}
              {weeks.map((week, col) =>
                week.map((iso, row) => {
                  const inWindow = iso >= heatmap.start && iso <= heatmap.end;
                  const inRange = iso >= heatmap.range_start && iso <= heatmap.range_end;
                  const day = inRange ? byDate.get(iso) : undefined;
                  const place = { gridColumn: col + 2, gridRow: row + 2 };
                  if (!inWindow) {
                    return <span key={iso} aria-hidden className="aspect-square w-full min-w-0" style={place} />;
                  }
                  const label = !inRange
                    ? `${formatDay(iso)}, outside the selected range`
                    : day && day.trades
                      ? `${formatDay(iso)}, ${tradeLabel(day.trades)}, ${formatMoney(day.pnl ?? 0, { signed: true, digits: 2 })}, ${formatPct(day.win_rate)} win rate`
                      : `${formatDay(iso)}, no trades`;
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-label={label}
                      onMouseEnter={(event) => placeTip(iso, event.currentTarget)}
                      onFocus={(event) => placeTip(iso, event.currentTarget)}
                      onBlur={() => setTip(null)}
                      className="aspect-square w-full min-w-0 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      style={{
                        ...place,
                        background: inRange ? cellColor(day, maxAbs) : "transparent",
                        boxShadow: inRange ? undefined : "inset 0 0 0 1px var(--color-border)",
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
          {tip ? (
            <div
              className="pointer-events-none absolute z-20 min-w-[108px] -translate-x-1/2 rounded-md bg-[#1B1C21] px-2.5 py-1.5 text-center shadow-lg"
              style={{
                left: tip.left,
                top: tip.above ? tip.top - 8 : tip.top + tip.height + 8,
                transform: tip.above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
              }}
            >
              <p className="text-[11px] font-medium leading-4 text-white">{formatDay(tip.iso)}</p>
              <p
                className={`text-[11px] font-semibold leading-4 ${
                  outsideActive || !activeDay?.trades
                    ? "text-[#C8C8D0]"
                    : (activeDay.pnl ?? 0) > 0
                      ? "text-[#3DDC97]"
                      : (activeDay.pnl ?? 0) < 0
                        ? "text-[#FF8D8D]"
                        : "text-white"
                }`}
              >
                {outsideActive
                  ? "Outside selected range"
                  : activeDay?.trades
                    ? formatMoney(activeDay.pnl ?? 0, { signed: true, digits: 2 })
                    : "No trades"}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
            <span className="mr-0.5">Loss</span>
            {[...LOSS].reverse().map((color) => (
              <span key={color} className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
            ))}
            <span className="h-3 w-3 rounded-[3px] border border-[var(--color-border)] bg-[var(--color-surface)]" />
            {PROFIT.map((color) => (
              <span key={color} className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
            ))}
            <span className="ml-0.5">Profit</span>
            <span className="sr-only">
              Profit color {PNL_PROFIT_HEX}, loss color {PNL_LOSS_HEX}
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
