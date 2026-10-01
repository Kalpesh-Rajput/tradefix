"use client";

import { Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { periodCaption } from "@/lib/ai-insights/presentation";
import type { InsightFilterParams, InsightWindow } from "@/lib/hooks/useAiInsights";
import type { AiInsightFacets } from "@/lib/types";

import { AskTradeFiz } from "./AskTradeFiz";
import { PeriodSelector } from "./PeriodSelector";
import { RefineFilters } from "./RefineFilters";

const askButton =
  "inline-flex h-8 shrink-0 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90";

export function TradeFizHeader({
  window,
  onWindow,
  filters,
  onFilters,
  facets,
  askQuestion,
  tradeCount,
  children,
}: {
  window: InsightWindow;
  onWindow: (window: InsightWindow) => void;
  filters: InsightFilterParams;
  onFilters: (next: InsightFilterParams) => void;
  facets?: AiInsightFacets | null;
  askQuestion: string;
  tradeCount?: number | null;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <header>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <motion.span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-very-light)] text-primary"
              initial={reduce ? false : { opacity: 0.6, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </motion.span>
            <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">TradeFix AI</h1>
          </div>
          <p className="mt-2 text-[15px] font-medium text-[var(--color-text-primary)]">Your personal trading intelligence</p>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--color-text-secondary)]">
            TradeFix analyzes your trades, behavior, rules and performance to surface the patterns that matter most.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSelector value={window} onChange={onWindow} />
            <AskTradeFiz question={askQuestion} className={askButton}>
              Ask TradeFix AI
            </AskTradeFiz>
          </div>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            {periodCaption(window)}
            {typeof tradeCount === "number" ? ` · ${tradeCount} trades` : ""}
          </p>
        </div>
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
      <RefineFilters facets={facets} value={filters} onChange={onFilters} />
    </header>
  );
}
