"use client";

import { Brain } from "lucide-react";

export function EmptyInsights({ tradesAnalysed }: { tradesAnalysed: number }) {
  return (
    <section className="dash-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <Brain className="h-4 w-4 text-primary" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
            TradeFix AI is learning your trading patterns
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
            Keep logging your trades and I&apos;ll start identifying your strongest setups,
            performance leaks, behavioral patterns and opportunities.
          </p>
          <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
            Trades analysed: {tradesAnalysed}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
            More trades will help TradeFix identify stronger patterns.
          </p>
        </div>
      </div>
    </section>
  );
}
