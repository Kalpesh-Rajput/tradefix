"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

import { TradeFixScoreCard } from "@/components/dashboard/tradefix-score/TradeFixScoreCard";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { fmtPct, fmtRatio, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../DrillContext";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { DeltaChip } from "../ui/Badges";

type Kpi = {
  key: string;
  label: string;
  hint: string;
  value: number | null;
  format: (n: number) => string;
  deltaFormat: (n: number) => string;
  color?: string;
  invert?: boolean;
  sub: string;
};

export function ExecutiveSection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const reduce = useReducedMotion();
  const s = data.summary;
  const c = data.comparison;
  const money = (n: number) => formatMoney(n);
  const pnlName = data.meta.pnl_mode === "gross" ? "Gross P&L" : "Net P&L";

  const kpis: Kpi[] = [
    {
      key: "net_pnl",
      label: pnlName,
      hint: `${data.meta.pnl_note}`,
      value: s.net_pnl,
      format: money,
      deltaFormat: (n) => formatMoney(n, { signed: false }),
      color: pnlColor(s.net_pnl),
      sub: `${s.trades.toLocaleString()} closed trades · ${s.trading_days} trading days`,
    },
    {
      key: "win_rate",
      label: "Win rate",
      hint: "Winning trades ÷ all closed trades. Breakeven trades count in the total but not as wins.",
      value: s.win_rate,
      format: (n) => fmtPct(n),
      deltaFormat: (n) => `${n.toFixed(1)} pts`,
      sub: `${s.wins}W · ${s.losses}L · ${s.breakeven} BE`,
    },
    {
      key: "profit_factor",
      label: "Profit factor",
      hint: "Gross profit ÷ gross loss. Above 1.0 means winners outweigh losers. Undefined when there are no losing trades.",
      value: s.profit_factor,
      format: (n) => fmtRatio(n),
      deltaFormat: (n) => fmtRatio(n),
      sub: `${formatMoney(s.gross_profit, { signed: false })} won · ${formatMoney(s.gross_loss, { signed: false })} lost`,
    },
    {
      key: "expectancy",
      label: "Expectancy",
      hint: "Average P&L per closed trade (total P&L ÷ trades) — what a typical trade has been worth in this period.",
      value: s.expectancy,
      format: money,
      deltaFormat: (n) => formatMoney(n, { signed: false }),
      color: pnlColor(s.expectancy),
      sub: s.avg_r != null ? `Avg ${s.avg_r.toFixed(2)}R on ${fmtPct(s.r_coverage, 0)} of trades with risk set` : "Set risk on trades to see R",
    },
    {
      key: "max_drawdown",
      label: "Max drawdown",
      hint: "Largest peak-to-trough fall in realized equity (starting balance + closed-trade P&L, in exit order).",
      value: s.max_drawdown ? -s.max_drawdown : 0,
      format: money,
      deltaFormat: (n) => formatMoney(n, { signed: false }),
      color: s.max_drawdown ? pnlColor(-1) : undefined,
      invert: true,
      sub: `${fmtPct(s.max_drawdown_pct)} of peak realized equity`,
    },
    {
      key: "payoff",
      label: "Payoff ratio",
      hint: "Average win ÷ average loss. With your win rate, this shows whether winners are big enough to cover losers.",
      value: s.payoff,
      format: (n) => `${fmtRatio(n)}×`,
      deltaFormat: (n) => fmtRatio(n),
      sub:
        s.avg_win != null && s.avg_loss != null
          ? `Avg win ${formatMoney(s.avg_win)} · avg loss ${formatMoney(s.avg_loss)}`
          : "Needs both wins and losses",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <TradeFixScoreCard score={data.score} formatMoney={formatMoney} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3 lg:grid-rows-2">
          {kpis.map((k, i) => (
            <motion.article
              key={k.key}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="dash-card flex min-h-[122px] flex-col p-3.5"
            >
              <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-label)]">
                <span className="truncate">{k.label}</span>
                <InfoTooltip content={k.hint} label={k.label} />
              </p>
              <p
                className="mt-1.5 truncate text-[22px] font-semibold leading-7 tracking-tight tabular-nums"
                style={{ color: k.color ?? "var(--color-text-kpi)" }}
              >
                <AnimatedNumber value={k.value} format={k.format} />
              </p>
              <div className="mt-1 h-4 truncate whitespace-nowrap leading-4">
                {c ? (
                  <DeltaChip
                    delta={k.key === "max_drawdown" ? c.max_drawdown?.delta : c[k.key]?.delta}
                    format={k.deltaFormat}
                    invert={k.invert}
                  />
                ) : (
                  <span className="text-[10px] text-[var(--color-text-muted)]">Set a date range to compare</span>
                )}
              </div>
              <p className="mt-auto truncate pt-1 text-[10px] text-[var(--color-text-muted)]">{k.sub}</p>
            </motion.article>
          ))}
        </div>
      </div>
      <DataQualityStrip data={data} />
    </div>
  );
}

function DataQualityStrip({ data }: { data: AdvancedAnalytics }) {
  const drill = useDrill();
  const q = data.data_quality;
  const parts: string[] = [`${data.meta.trade_count.toLocaleString()} closed trades analysed (${data.meta.period_label})`];
  if (data.meta.open_trades_excluded) parts.push(`${data.meta.open_trades_excluded} open excluded`);
  if (q.missing_risk) parts.push(`${q.missing_risk} without a risk amount`);
  if (q.unrated) parts.push(`${q.unrated} unrated`);
  if (q.skipped_invalid_pnl) parts.push(`${q.skipped_invalid_pnl} skipped (invalid P&L)`);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-[var(--color-text-muted)]">
      <span>{parts.join(" · ")}</span>
      <span>Timezone: {data.meta.timezone}</span>
      {q.possible_duplicates ? (
        <button
          type="button"
          onClick={() => drill({ dimension: "duplicate", key: "yes" }, "Possible duplicate trades")}
          title={q.duplicate_note}
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 outline-none hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-amber-500/30"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {q.possible_duplicates} possible duplicates — review
        </button>
      ) : null}
    </div>
  );
}
