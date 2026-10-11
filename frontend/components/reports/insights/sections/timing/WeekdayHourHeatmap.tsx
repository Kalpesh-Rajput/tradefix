"use client";

import { useMemo, useState } from "react";

import { HoverTip } from "@/components/ui/InfoTooltip";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics, TimeCell } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../../DrillContext";
import { heatColor, neutralHeat } from "../../ui/heat";
import { InsightCard, InsufficientState } from "../../ui/InsightCard";
import { Segmented } from "../../ui/Segmented";

type Metric = "pnl" | "win" | "count";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const COUNT_RGB = "59, 106, 224";

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export function WeekdayHourHeatmap({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const t = data.timing;
  const [metric, setMetric] = useState<Metric>("pnl");

  const model = useMemo(() => {
    const cells = new Map(t.weekday_hour.map((c) => [`${c.weekday}-${c.hour}`, c]));
    const activeHours = t.weekday_hour.map((c) => c.hour);
    const lo = activeHours.length ? Math.min(...activeHours) : 0;
    const hi = activeHours.length ? Math.max(...activeHours) : 23;
    const hours = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const activeDays = new Set(t.weekday_hour.map((c) => c.weekday));
    const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => d < 5 || activeDays.has(d));
    const val = (c: TimeCell) => (metric === "pnl" ? c.net_pnl : metric === "win" ? (c.win_rate ?? 50) - 50 : c.trades);
    const all = [...t.weekday_hour, ...t.weekdays, ...t.hours];
    const maxCell = Math.max(0, ...t.weekday_hour.map((c) => Math.abs(val(c))));
    const maxMargin = Math.max(0, ...all.filter((c) => !("hour" in c && "weekday" in c)).map((c) => Math.abs(val(c))));
    return { cells, hours, days, val, maxCell, maxMargin };
  }, [t, metric]);

  const color = (c: TimeCell | undefined, max: number) => {
    if (!c?.trades) return "var(--color-surface-secondary)";
    const v = model.val(c);
    return metric === "count" ? neutralHeat(v, max, COUNT_RGB) : heatColor(v, max);
  };
  const text = (c: TimeCell) =>
    metric === "pnl" ? formatMoney(c.net_pnl, { digits: 0 }) : metric === "win" ? fmtPct(c.win_rate, 0) : String(c.trades);
  const tip = (title: string, c: TimeCell) =>
    `${title}: ${c.trades} trades · ${formatMoney(c.net_pnl)} · ${fmtPct(c.win_rate, 0)} win · avg ${formatMoney(c.avg_pnl ?? 0)}`;

  const weekdayByIdx = new Map(t.weekdays.map((w) => [w.weekday, w]));
  const hourByIdx = new Map(t.hours.map((h) => [h.hour, h]));

  return (
    <InsightCard
      title="When you trade best"
      caption={`Weekday × hour of entry · ${t.timezone_basis}`}
      hint="Each cell is every trade entered in that weekday and hour. Row and column totals are on the edges. Click any cell to see its trades."
      actions={
        <Segmented<Metric>
          value={metric}
          onChange={setMetric}
          ariaLabel="Heatmap metric"
          options={[
            { id: "pnl", label: "P&L" },
            { id: "win", label: "Win %" },
            { id: "count", label: "Trades" },
          ]}
        />
      }
    >
      {!t.weekday_hour.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={260} />
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="border-separate border-spacing-[3px] text-[10px]" style={{ minWidth: 90 + model.hours.length * 46 }}>
            <thead>
              <tr className="text-[var(--color-text-muted)]">
                <th className="w-10" />
                {model.hours.map((h) => (
                  <th key={h} className="w-11 font-medium">
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
                <th className="w-16 pl-1 text-right font-medium">Day</th>
              </tr>
            </thead>
            <tbody>
              {model.days.map((d) => {
                const total = weekdayByIdx.get(d);
                return (
                  <tr key={d}>
                    <th className="pr-1 text-left font-medium text-[var(--color-text-secondary)]">{WEEKDAYS[d]}</th>
                    {model.hours.map((h) => {
                      const c = model.cells.get(`${d}-${h}`);
                      if (!c?.trades) return <td key={h} className="h-8 rounded bg-[var(--color-surface-secondary)]" aria-hidden />;
                      return (
                        <td key={h} className="h-8 p-0">
                          <HoverTip content={tip(`${WEEKDAY_FULL[d]} ${hourLabel(h)}`, c)}>
                            <button
                              type="button"
                              onClick={() => drill({ dimension: "weekday_hour", key: c.key }, `${WEEKDAY_FULL[d]}s, ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`)}
                              className="flex h-8 w-full items-center justify-center rounded text-[9.5px] font-semibold tabular-nums outline-none transition-transform hover:scale-[1.08] focus-visible:ring-2 focus-visible:ring-primary/30"
                              style={{ background: color(c, model.maxCell), color: metric === "count" ? "var(--color-text-primary)" : pnlColor(model.val(c)) }}
                            >
                              {text(c)}
                            </button>
                          </HoverTip>
                        </td>
                      );
                    })}
                    <td className="p-0 pl-1">
                      {total?.trades ? (
                        <button
                          type="button"
                          onClick={() => drill({ dimension: "weekday", key: String(d) }, `${WEEKDAY_FULL[d]} trades`)}
                          className="flex h-8 w-full items-center justify-end rounded px-1.5 text-[10px] font-semibold tabular-nums outline-none hover:bg-[var(--color-surface-secondary)] focus-visible:ring-2 focus-visible:ring-primary/30"
                          style={{ color: metric === "count" ? undefined : pnlColor(model.val(total)) }}
                        >
                          {text(total)}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <th className="pr-1 pt-1 text-left font-medium text-[var(--color-text-muted)]">Hour</th>
                {model.hours.map((h) => {
                  const c = hourByIdx.get(h);
                  return (
                    <td key={h} className="p-0 pt-1">
                      {c?.trades ? (
                        <button
                          type="button"
                          onClick={() => drill({ dimension: "hour", key: String(h) }, `Trades entered ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`)}
                          className="flex h-7 w-full items-center justify-center rounded text-[9.5px] font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          style={{ background: color(c, model.maxMargin), color: metric === "count" ? undefined : pnlColor(model.val(c)) }}
                        >
                          {text(c)}
                        </button>
                      ) : null}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </InsightCard>
  );
}
