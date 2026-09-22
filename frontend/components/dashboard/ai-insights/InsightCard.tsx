"use client";

import Link from "next/link";

import { chatHref, tradesHref } from "@/lib/ai-insights/links";
import type { AiInsightCard } from "@/lib/types";

import { categoryMeta } from "./category";
import { InsightWhy } from "./InsightWhy";

export function InsightCard({ card }: { card: AiInsightCard }) {
  const meta = categoryMeta(card.category, card.confidence);
  const Icon = meta.icon;
  const href = tradesHref(card.trade_filter);
  const news = card.news_items?.filter((item) => item.url) ?? [];

  return (
    <article className="dash-card flex h-full min-h-0 flex-col p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} strokeWidth={2} />
          <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.className}`}>
            {meta.label}
          </p>
        </div>
      </div>
      <h3 className="mt-1.5 text-[13px] font-semibold leading-4 text-[var(--color-text-primary)]">{card.title}</h3>
      <p className="mt-1 text-[12px] leading-4 text-[var(--color-text-secondary)]">{card.explanation}</p>

      {card.metrics.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
          {card.metrics.map((metric) => (
            <div key={`${card.id}-${metric.label}`} className="min-w-0">
              <dt className="text-[10px] text-[var(--color-text-tertiary)]">{metric.label}</dt>
              <dd
                className={
                  metric.tone === "pos"
                    ? "truncate text-[12px] font-medium text-[#2F9E6A]"
                    : metric.tone === "neg"
                      ? "truncate text-[12px] font-medium text-[#C4473A]"
                      : "truncate text-[12px] font-medium text-[var(--color-text-primary)]"
                }
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-3 text-[12px] leading-4 text-[var(--color-text-secondary)]">{card.evidence}</p>
      <InsightWhy why={card.why} />

      {news.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {news.slice(0, 2).map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary hover:underline"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Link
          href={href}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
        >
          {card.primary_action_label}
        </Link>
        <Link
          href={chatHref(card.ask_question)}
          className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
        >
          Ask TradeFix AI
        </Link>
      </div>
    </article>
  );
}
