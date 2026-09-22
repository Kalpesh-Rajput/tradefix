"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

import { useJournalAi } from "@/components/ai/panel/JournalAiContext";
import { JOURNAL_TAKE_ACTIONS, type JournalTakeAction } from "@/components/ai/panel/prompts";

const actionClass =
  "flex w-full items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-left text-[12px] font-medium leading-4 text-[var(--color-text-secondary)] transition duration-150 hover:border-primary/30 hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50";

export function TradeFixAIActionButtons({
  actions = JOURNAL_TAKE_ACTIONS,
}: {
  actions?: JournalTakeAction[];
}) {
  const { pending, ask } = useJournalAi();
  if (actions.length === 0) return null;

  return (
    <section aria-label="Take action">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        <Zap className="h-3.5 w-3.5 text-primary" strokeWidth={2} aria-hidden />
        Take action
      </h3>
      <div className="mt-2 flex flex-col gap-1.5">
        {actions.map((action) =>
          action.href ? (
            <Link key={action.id} href={action.href} className={actionClass}>
              {action.label}
            </Link>
          ) : (
            <button
              key={action.id}
              type="button"
              disabled={pending || !action.question}
              onClick={() => action.question && ask(action.question, action.id)}
              className={actionClass}
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </section>
  );
}
