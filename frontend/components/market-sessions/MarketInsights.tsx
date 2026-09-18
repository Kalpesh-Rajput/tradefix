"use client";

import { Activity } from "lucide-react";

import { buildMarketInsights } from "@/components/market-sessions/sessionUi";
import type { MarketSessionSnapshot } from "@/lib/market-sessions/types";

export function MarketInsights({ snapshot, now }: { snapshot: MarketSessionSnapshot; now: Date }) {
  const insights = buildMarketInsights(snapshot, now);
  if (insights.length === 0) return null;

  return (
    <section className="ms-card p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        <Activity className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        Market insight
      </p>
      <ul className="space-y-1.5">
        {insights.map((text) => (
          <li key={text} className="flex items-start gap-2 text-[13px] text-[var(--color-text-secondary)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
    </section>
  );
}
