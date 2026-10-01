"use client";

import { Sparkles } from "lucide-react";

import { briefFindings } from "@/lib/ai-insights/presentation";
import type { AiInsightCard, AiInsightSummary } from "@/lib/types";

import { AskTradeFiz } from "./AskTradeFiz";

const primaryButton =
  "inline-flex h-9 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90";
const secondaryButton =
  "inline-flex h-9 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors duration-200 hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]";

export function TradingBrief({
  summary,
  cards,
  askQuestion,
  onExplore,
}: {
  summary: AiInsightSummary | null;
  cards: AiInsightCard[];
  askQuestion: string;
  onExplore: () => void;
}) {
  const findings = briefFindings(cards);
  const rows = [
    findings.issue ? { label: "Biggest issue", value: findings.issue.title } : null,
    findings.edge ? { label: "Strongest edge", value: findings.edge.title } : null,
    findings.change ? { label: "Performance change", value: findings.change.title } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <section className="dash-card px-5 py-5 sm:px-6">
      <div className="flex items-center gap-1.5 text-primary">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">AI trading brief</p>
      </div>
      <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-[22px]">
        Your Trading Intelligence
      </h2>
      <p className="mt-1 text-[14px] text-[var(--color-text-secondary)]">
        Here&apos;s what TradeFix noticed about your trading.
      </p>
      {summary?.text ? (
        <p className="mt-4 max-w-3xl text-[14px] leading-6 text-[var(--color-text-primary)] line-clamp-3">{summary.text}</p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                {row.label}
              </dt>
              <dd className="mt-1 line-clamp-2 text-[14px] font-medium leading-5 text-[var(--color-text-primary)]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onExplore} className={secondaryButton}>
          Explore Insights
        </button>
        <AskTradeFiz question={askQuestion} className={primaryButton}>
          Ask TradeFix AI
        </AskTradeFiz>
      </div>
    </section>
  );
}
