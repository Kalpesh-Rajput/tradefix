"use client";

import { useMemo, useState } from "react";

import { HoverTip } from "@/components/ui/InfoTooltip";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics, MonthRow } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../../DrillContext";
import { heatColor } from "../../ui/heat";
import { InsightCard, InsufficientState } from "../../ui/InsightCard";
import { Segmented } from "../../ui/Segmented";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Metric = "pnl" | "return";

export function MonthlyReturns({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const rows = data.performance.monthly;
  const hasReturn = rows.some((r) => r.return_pct != null);
  const [metric, setMetric] = useState<Metric>("pnl");
  const useReturn = metric === "return" && hasReturn;

  const { years, byKey, maxAbs, yearTotals } = useMemo(() => {
    const byKey = new Map<string, MonthRow>();
    const yearTotals = new Map<number, { pnl: number; trades: number }>();
    for (const r of rows) {
      byKey.set(r.key, r);
      const t = yearTotals.get(r.year) ?? { pnl: 0, trades: 0 };
      t.pnl += r.net_pnl;
      t.trades += r.trades;
      yearTotals.set(r.year, t);
    }
    const values = rows.map((r) => Math.abs((useReturn ? r.return_pct : r.net_pnl) ?? 0));
    return {
      years: [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a),
      byKey,
      maxAbs: Math.max(0, ...values),
      yearTotals,
    };
  }, [rows, useReturn]);

  const fmt = (r: MonthRow) => (useReturn ? fmtPct(r.return_pct) : formatMoney(r.net_pnl, { digits: 0 }));

  return (
    <InsightCard
      title="Monthly returns"
      caption={useReturn ? "Month P&L ÷ realized equity at the start of the month" : "Closed-trade P&L by month of exit"}
      hint="Click a month to see its trades. Return % uses realized equity (starting balance + earlier closed P&L); deposits and withdrawals are not tracked."
      actions={
        hasReturn ? (
          <Segmented<Metric>
            value={metric}
            onChange={setMetric}
            ariaLabel="Monthly metric"
            options={[
              { id: "pnl", label: "P&L" },
              { id: "return", label: "Return %" },
            ]}
          />
        ) : null
      }
    >
      {!rows.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={180} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-1 text-[11px]">
            <colgroup>
              <col className="w-12" />
              {MONTHS.map((m) => (
                <col key={m} />
              ))}
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="text-[10px] font-medium text-[var(--color-text-muted)]">
                <th className="text-left font-medium" />
                {MONTHS.map((m) => (
                  <th key={m} className="font-medium">
                    {m}
                  </th>
                ))}
                <th className="text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const total = yearTotals.get(year)!;
                return (
                  <tr key={year}>
                    <td className="text-[11px] font-semibold text-[var(--color-text-secondary)]">{year}</td>
                    {MONTHS.map((_, i) => {
                      const r = byKey.get(`${year}-${String(i + 1).padStart(2, "0")}`);
                      if (!r) {
                        return <td key={i} className="h-10 rounded-md bg-[var(--color-surface-secondary)]" aria-hidden />;
                      }
                      const v = (useReturn ? r.return_pct : r.net_pnl) ?? 0;
                      return (
                        <td key={i} className="h-10 p-0">
                          <HoverTip
                            content={`${r.label}: ${formatMoney(r.net_pnl)} · ${r.trades} trades · ${fmtPct(r.win_rate, 0)} win${
                              r.return_pct != null ? ` · ${fmtPct(r.return_pct)} return` : ""
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => drill({ dimension: "month", key: r.key }, `Trades closed in ${r.label}`)}
                              className="flex h-10 w-full items-center justify-center rounded-md text-[10.5px] font-semibold tabular-nums outline-none transition-transform hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-primary/30"
                              style={{ background: heatColor(v, maxAbs), color: pnlColor(v) }}
                            >
                              {fmt(r)}
                            </button>
                          </HoverTip>
                        </td>
                      );
                    })}
                    <td className="text-right text-[11px] font-semibold tabular-nums" style={{ color: pnlColor(total.pnl) }}>
                      {formatMoney(total.pnl, { digits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </InsightCard>
  );
}
