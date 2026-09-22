"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";

import { ANALYZE_CATEGORIES, BASE_PROMPTS, personalizedPrompts, type PromptCard } from "@/components/ai/suggestions";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { CoachWeekly } from "@/lib/types";

export function WelcomeState({
  weekly,
  tradeCount,
  onAsk,
}: {
  weekly?: CoachWeekly | null;
  tradeCount?: number | null;
  onAsk: (question: string) => void;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const extra = personalizedPrompts(weekly);
  const cards = [...extra, ...BASE_PROMPTS].slice(0, 8);
  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "dashboard.greeting.morning" : hour < 17 ? "dashboard.greeting.afternoon" : "dashboard.greeting.evening";

  const sampleNote =
    tradeCount == null
      ? null
      : tradeCount === 0
        ? "Once you log your first trades, I'll be able to analyze your performance."
        : tradeCount < 50
          ? `You currently have ${tradeCount} closed trades. I can analyze them, but some patterns may not be statistically meaningful yet.`
          : null;

  return (
    <div className="flex flex-1 flex-col">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: reduce ? 0 : 0.04 }}
      >
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-[22px]">
          {t(greetingKey)}
        </h2>
        <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">
          What would you like to understand about your trading?
        </p>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Your AI can analyze
        </p>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
          {ANALYZE_CATEGORIES.map((label) => (
            <span
              key={label}
              className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]"
            >
              {label}
            </span>
          ))}
        </div>
        {sampleNote ? (
          <p className="mt-3 text-[12px] leading-5 text-[var(--color-text-tertiary)]">{sampleNote}</p>
        ) : null}
      </motion.div>

      <SuggestionGrid cards={cards} onAsk={onAsk} />
    </div>
  );
}

function SuggestionGrid({ cards, onAsk }: { cards: PromptCard[]; onAsk: (question: string) => void }) {
  const reduce = useReducedMotion();

  return (
    <div className="mt-5 flex gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.button
            key={card.id}
            type="button"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: reduce ? 0 : 0.05 + index * 0.03 }}
            onClick={() => onAsk(card.question)}
            className={clsx(
              "ai-prompt-card group flex min-w-[220px] flex-col items-start rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-left shadow-sm sm:min-w-0",
              "transition-[transform,box-shadow,border-color] duration-200",
              "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
              "motion-reduce:transform-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            )}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-primary-very-light)] text-primary transition-transform duration-200 group-hover:-translate-y-px">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="mt-2.5 text-[12px] font-semibold text-[var(--color-text-primary)]">{card.title}</span>
            <span className="mt-0.5 text-[12px] leading-5 text-[var(--color-text-tertiary)]">{card.question}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
