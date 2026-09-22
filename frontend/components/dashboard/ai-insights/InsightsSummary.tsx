"use client";

import { Brain } from "lucide-react";
import Link from "next/link";

import { chatHref } from "@/lib/ai-insights/links";
import type { AiInsightSummary } from "@/lib/types";

export function InsightsSummary({ summary }: { summary: AiInsightSummary }) {
  return (
    <div className="dash-card p-3.5 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <Brain className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">TradeFix AI Insights</h2>
              <p className="text-[11px] text-[var(--color-text-tertiary)]">Things I noticed in your trading</p>
            </div>
            <Link
              href={chatHref(summary.ask_question === "Ask about my performance" ? "Analyse my recent performance" : summary.ask_question)}
              className="inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Ask about my performance
            </Link>
          </div>
          <p className="mt-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">{summary.text}</p>
        </div>
      </div>
    </div>
  );
}
