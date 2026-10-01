"use client";

import Link from "next/link";

import { InsightWhy } from "@/components/dashboard/ai-insights/InsightWhy";
import { CATEGORY_META } from "@/components/dashboard/ai-insights/category";
import { insightActionHref } from "@/lib/ai-insights/links";
import { askLabel } from "@/lib/ai-insights/presentation";
import type { AiInsightCard, AiInsightCategory } from "@/lib/types";

import { AskTradeFiz } from "./AskTradeFiz";

const ACCENT: Record<AiInsightCategory, string> = {
  edge: "border-l-[#2F9E6A]",
  leak: "border-l-[#C4473A]",
  overtrading: "border-l-[#C4473A]",
  behavior: "border-l-[#C47A1A]",
  rule: "border-l-[#C47A1A]",
  early: "border-l-[#C47A1A]",
  change: "border-l-primary",
  news: "border-l-primary",
};

export function PremiumInsightCard({ card }: { card: AiInsightCard }) {
  const meta = CATEGORY_META[card.category] ?? CATEGORY_META.early;
  const Icon = meta.icon;

  return (
    <article
      className={`dash-card flex h-full min-h-0 flex-col border-l-2 p-5 transition-[border-color,box-shadow] duration-200 hover:shadow-md ${ACCENT[card.category]}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} strokeWidth={2} />
        <p className={`truncate text-[11px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}>{meta.label}</p>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[17px] font-semibold leading-6 text-[var(--color-text-primary)]">{card.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-[14px] leading-5 text-[var(--color-text-secondary)]">{card.explanation}</p>

      {card.metrics.length > 0 ? (
        <dl className="mt-4 grid grid-cols-3 gap-4">
          {card.metrics.map((metric) => (
            <div key={`${card.id}-${metric.label}`} className="min-w-0">
              <dt className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
                {metric.label}
              </dt>
              <dd
                className={
                  metric.tone === "pos"
                    ? "mt-1 truncate text-[22px] font-semibold leading-7 text-[#2F9E6A]"
                    : metric.tone === "neg"
                      ? "mt-1 truncate text-[22px] font-semibold leading-7 text-[#C4473A]"
                      : "mt-1 truncate text-[22px] font-semibold leading-7 text-[var(--color-text-primary)]"
                }
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-4 line-clamp-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">{card.evidence}</p>
      <InsightWhy why={card.why} />

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={insightActionHref(card)}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] transition-colors duration-200 hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]"
        >
          {card.primary_action_label}
        </Link>
        <AskTradeFiz
          question={card.ask_question}
          className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90"
        >
          {askLabel(card.category)}
        </AskTradeFiz>
      </div>
    </article>
  );
}
