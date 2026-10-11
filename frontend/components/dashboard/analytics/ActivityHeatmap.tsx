"use client";

import { useMemo } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { BAR_LOSS_HEX, BAR_PROFIT_HEX } from "@/lib/appearance";
import type { DashboardPerformance, HeatmapDay } from "@/lib/types";

import { AnalyticsEmpty, FloatingTip, formatPct, pnlTone, tradeLabel, useFloatingTip, type MoneyFormat, type TipRow } from "./shared";

const PROFIT = ["#E5F8F2", "#C3EEDF", "#8FE0C4", "#5ED4A8", "#40C79A"];
const LOSS = ["#FDECEC", "#F9C9C9", "#F6A3A3", "#F48686", "#F26969"];
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
  return fromIso(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function heatmapRows(day: HeatmapDay | undefined, outside: boolean, formatMoney: MoneyFormat): TipRow[] {
  if (outside) return [{ label: "Range", value: "Outside selected range" }];
  if (!day?.trades) return [{ label: "Closed trades", value: "None" }];
  return [
    {
      label: "Net P&L",
      value: formatMoney(day.pnl ?? 0, { signed: true, digits: 2 }),
      tone: pnlTone(day.pnl),
    },
    { label: "Winning trades", value: String(day.wins) },
    { label: "Losing trades", value: String(day.losses) },
    { label: "Total trades", value: tradeLabel(day.trades) },
    { label: "Win rate", value: formatPct(day.win_rate) },
  ];
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
  const hover = useFloatingTip();
  const activeDay = hover.tip ? byDate.get(hover.tip.key) : undefined;
  const outsideActive = hover.tip != null && (hover.tip.key < heatmap.range_start || hover.tip.key > heatmap.range_end);

  function placeTip(iso: string, element: HTMLElement) {
    const day = byDate.get(iso);
    const inRange = iso >= heatmap.range_start && iso <= heatmap.range_end;
    hover.show(iso, element, inRange && day?.trades ? 156 : 72);
  }

  return (
    <ChartCard
      title={`${t("dashboard.activityHeatmap")} (Past Year)`}
      hint={t("dashboard.hint.activityHeatmap")}
    >
      {!data.has_trades ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.heatmap")} />
      ) : (
        <div className="relative min-w-0" onMouseLeave={hover.hide}>
          <div className="heatmap-scroll min-w-0 overflow-x-auto overflow-y-hidden">
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
                      onBlur={hover.hide}
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
          <FloatingTip
            tip={hover.tip}
            title={hover.tip ? formatDay(hover.tip.key) : ""}
            rows={heatmapRows(activeDay, outsideActive, formatMoney)}
          />
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
              Profit color {BAR_PROFIT_HEX}, loss color {BAR_LOSS_HEX}
            </span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
