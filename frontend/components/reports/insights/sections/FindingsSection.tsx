"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics, Finding } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../DrillContext";
import { EvidenceBadge } from "../ui/Badges";
import { InsightCard, InsufficientState } from "../ui/InsightCard";

const FINDINGS_H = 340;

export function FindingsSection({
  data,
  formatMoney,
  goals,
}: {
  data: AdvancedAnalytics;
  formatMoney: MoneyFormatter;
  goals: ReactNode;
}) {
  const { items, status, reason, candidates_evaluated, ranking_method } = data.insights;
  return (
    <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <InsightCard
          title="Key findings"
          caption={
            items.length
              ? `${items.length} of ${candidates_evaluated} patterns tested passed the evidence bar`
              : "Patterns are tested against the rest of your trades"
          }
          hint={`${ranking_method} Findings describe associations in your history, not causes.`}
        >
          <div className="overflow-y-auto pr-1" style={{ height: FINDINGS_H }}>
            {status === "insufficient" || !items.length ? (
              <InsufficientState
                reason={
                  reason ??
                  "No pattern stands out from normal variation yet. Keep tagging strategy, emotions, and rules — findings appear once a gap is large enough to trust."
                }
                height={FINDINGS_H}
              />
            ) : (
              <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {items.map((f, i) => (
                  <FindingItem key={f.id} finding={f} index={i} formatMoney={formatMoney} />
                ))}
              </ul>
            )}
          </div>
        </InsightCard>
      </div>
      <div className="lg:col-span-4 [&>section]:h-full">{goals}</div>
    </div>
  );
}

function FindingItem({ finding: f, index, formatMoney }: { finding: Finding; index: number; formatMoney: MoneyFormatter }) {
  const reduce = useReducedMotion();
  const drill = useDrill();
  const positive = f.tone === "positive";
  const Icon = positive ? TrendingUp : TrendingDown;
  const accent = positive ? PNL_PROFIT_HEX : PNL_LOSS_HEX;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reduce ? 0 : index * 0.04 }}
    >
      <div className="group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] p-3 text-left transition-colors focus-within:ring-2 focus-within:ring-primary/30 hover:border-[var(--color-border)] hover:bg-[var(--color-surface)]">
        <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} aria-hidden />
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ background: `${accent}1a`, color: accent }}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{f.category}</p>
            <button
              type="button"
              onClick={() => drill(f.drill, f.headline)}
              className="mt-0.5 text-left text-[12.5px] font-semibold leading-snug text-[var(--color-text-primary)] outline-none after:absolute after:inset-0 after:content-['']"
            >
              {f.headline}
            </button>
          </div>
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-[var(--color-text-muted)]">{f.metric_label} · these trades</p>
            <p className="font-semibold tabular-nums" style={{ color: pnlColor(f.value) }}>
              {f.value != null ? formatMoney(f.value) : "—"}
              <span className="ml-1 font-normal text-[var(--color-text-muted)]">{fmtPct(f.win_rate, 0)} win</span>
            </p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">Your other trades</p>
            <p className="font-semibold tabular-nums" style={{ color: pnlColor(f.baseline) }}>
              {f.baseline != null ? formatMoney(f.baseline) : "—"}
              <span className="ml-1 font-normal text-[var(--color-text-muted)]">{fmtPct(f.win_rate_baseline, 0)} win</span>
            </p>
          </div>
        </div>
        <div className="relative z-10 mt-2.5 flex w-fit flex-wrap items-center gap-1.5">
          <EvidenceBadge evidence={f.evidence} />
          <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">
            {f.sample_size} vs {f.comparison_size} trades
          </span>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--color-text-tertiary)]">
          {f.qualification ?? f.explanation}
        </p>
      </div>
    </motion.li>
  );
}
