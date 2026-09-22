"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";

import { useJournalAi } from "@/components/ai/panel/JournalAiContext";
import { JOURNAL_QUICK_ACTIONS } from "@/components/ai/panel/prompts";

export function TradeFixAIQuickActions() {
  const { pending, selectedQuickPrompt, ask } = useJournalAi();
  const reduce = useReducedMotion();

  return (
    <div className="grid grid-cols-2 gap-2">
      {JOURNAL_QUICK_ACTIONS.map((action, index) => {
        const selected = selectedQuickPrompt === action.id;
        return (
          <motion.button
            key={action.id}
            type="button"
            disabled={pending}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: reduce ? 0 : 0.04 + index * 0.03 }}
            onClick={() => ask(action.question, action.id)}
            className={clsx(
              "rounded-xl border px-3 py-2.5 text-left text-[12px] font-medium leading-4 transition duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "disabled:opacity-50",
              selected
                ? "border-primary/40 bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-secondary)] hover:border-primary/30 hover:text-[var(--color-text-primary)]"
            )}
          >
            {action.label}
          </motion.button>
        );
      })}
    </div>
  );
}
