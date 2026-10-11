"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { downloadCsv, fmtPct, fmtR, fmtRatio, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics, LeaderRow } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../../DrillContext";
import { InsightCard, InsufficientState } from "../../ui/InsightCard";
import { Segmented } from "../../ui/Segmented";

type Tab = "strategy" | "setup";
type SortKey = "trades" | "win_rate" | "net_pnl" | "avg_pnl" | "profit_factor" | "avg_r";

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "trades", label: "Trades" },
  { key: "win_rate", label: "Win %" },
  { key: "net_pnl", label: "P&L" },
  { key: "avg_pnl", label: "Expectancy" },
  { key: "profit_factor", label: "PF" },
  { key: "avg_r", label: "Avg R" },
];

const BODY_H = 300;

export function Leaderboard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const [tab, setTab] = useState<Tab>("strategy");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "net_pnl", desc: true });
  const source = tab === "strategy" ? data.strategy.strategies : data.strategy.setups;

  const rows = useMemo(() => {
    const val = (r: LeaderRow) => r[sort.key] ?? Number.NEGATIVE_INFINITY;
    return [...source].sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
  }, [source, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  const exportCsv = () =>
    downloadCsv(
      `tradefix-${tab}-leaderboard.csv`,
      [tab === "strategy" ? "Strategy" : "Setup", "Trades", "Wins", "Losses", "Win rate %", "Net P&L", "Expectancy", "Profit factor", "Avg R", "Win rate last 30d %", "Win rate prior 30d %"],
      rows.map((r) => [r.label, r.trades, r.wins, r.losses, r.win_rate, r.net_pnl, r.avg_pnl, r.profit_factor, r.avg_r, r.win_rate_last_30d, r.win_rate_prior_30d])
    );

  return (
    <InsightCard
      title="Playbook leaderboard"
      caption={
        tab === "setup" && data.strategy.setup_overlap.multi_tagged_trades
          ? data.strategy.setup_overlap.note
          : "Every strategy and setup you tagged, ranked — click a row to see its trades"
      }
      hint="Expectancy = average P&L per trade. Trend compares win rate in the last 30 days of this range to the 30 days before. A trade with several setup tags counts in each of them."
      actions={
        <>
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            ariaLabel="Leaderboard grouping"
            options={[
              { id: "strategy", label: "Strategies" },
              { id: "setup", label: "Setups" },
            ]}
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            aria-label="Export leaderboard as CSV"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </>
      }
    >
      {!rows.length ? (
        <InsufficientState reason="No closed trades in this range yet." height={BODY_H} />
      ) : (
        <div className="overflow-auto" style={{ maxHeight: BODY_H }}>
          <table className="w-full min-w-[640px] text-[11.5px]">
            <thead className="sticky top-0 z-[1] bg-[var(--color-surface)]">
              <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
                <th className="py-2 pr-2 text-left font-medium">{tab === "strategy" ? "Strategy" : "Setup"}</th>
                {COLUMNS.map((c) => {
                  const on = sort.key === c.key;
                  return (
                    <th key={c.key} className="px-2 py-2 text-right font-medium" aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}>
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={clsx("inline-flex items-center gap-0.5 outline-none hover:text-[var(--color-text-primary)] focus-visible:text-[var(--color-primary)]", on && "text-[var(--color-text-primary)]")}
                      >
                        {c.label}
                        {on ? sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null}
                      </button>
                    </th>
                  );
                })}
                <th className="px-2 py-2 text-right font-medium">30d trend</th>
                <th className="py-2 pl-2 text-right font-medium">Cumulative P&L</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const trend =
                  r.win_rate_last_30d != null && r.win_rate_prior_30d != null ? r.win_rate_last_30d - r.win_rate_prior_30d : null;
                return (
                  <tr
                    key={r.key}
                    tabIndex={0}
                    onClick={() => drill({ dimension: tab, key: r.key }, `${tab === "strategy" ? "Strategy" : "Setup"}: ${r.label}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        drill({ dimension: tab, key: r.key }, `${tab === "strategy" ? "Strategy" : "Setup"}: ${r.label}`);
                      }
                    }}
                    className="cursor-pointer border-b border-[var(--color-border-subtle)] outline-none transition-colors last:border-0 hover:bg-[var(--color-surface-secondary)] focus-visible:bg-[var(--color-primary-very-light)]"
                  >
                    <td className="max-w-[180px] truncate py-2 pr-2 font-semibold text-[var(--color-text-primary)]">{r.label}</td>
                    <td className="px-2 text-right tabular-nums">{r.trades}</td>
                    <td className="px-2 text-right tabular-nums">{fmtPct(r.win_rate, 0)}</td>
                    <td className="px-2 text-right font-semibold tabular-nums" style={{ color: pnlColor(r.net_pnl) }}>
                      {formatMoney(r.net_pnl, { digits: 0 })}
                    </td>
                    <td className="px-2 text-right tabular-nums" style={{ color: pnlColor(r.avg_pnl) }}>
                      {r.avg_pnl != null ? formatMoney(r.avg_pnl) : "—"}
                    </td>
                    <td className="px-2 text-right tabular-nums">{fmtRatio(r.profit_factor)}</td>
                    <td className="px-2 text-right tabular-nums">{fmtR(r.avg_r)}</td>
                    <td className="px-2 text-right tabular-nums">
                      {trend == null ? (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      ) : (
                        <span style={{ color: trend > 0 ? PNL_PROFIT_HEX : trend < 0 ? PNL_LOSS_HEX : undefined }}>
                          {trend > 0 ? "+" : ""}
                          {trend.toFixed(0)} pts
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-2">
                      <Spark values={r.spark} />
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

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="block text-right text-[var(--color-text-muted)]">—</span>;
  const w = 72;
  const h = 20;
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * h}`).join(" ");
  const last = values[values.length - 1];
  const zeroY = h - ((0 - min) / span) * h;
  return (
    <svg width={w} height={h} className="ml-auto block" aria-hidden>
      <line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="var(--color-border)" strokeDasharray="2 2" />
      <polyline points={pts} fill="none" stroke={last >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
