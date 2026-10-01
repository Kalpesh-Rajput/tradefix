"use client";

import { Target } from "lucide-react";
import { useState } from "react";

import { AddRuleModal } from "@/components/dashboard/ai-insights/AddRuleModal";
import type { AiInsightFocus } from "@/lib/types";

import { AskTradeFiz } from "./AskTradeFiz";

export function FocusSection({ focus }: { focus: AiInsightFocus }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="dash-card border-l-[3px] border-l-primary px-5 py-5 sm:px-6">
      <div className="flex items-center gap-1.5 text-primary">
        <Target className="h-3.5 w-3.5" strokeWidth={2} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">Your Focus</p>
      </div>
      <h2 className="mt-3 max-w-3xl text-[20px] font-semibold leading-7 text-[var(--color-text-primary)] sm:text-[22px]">
        {focus.title}
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 md:gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Why</p>
          <p className="mt-1 text-[14px] leading-6 text-[var(--color-text-secondary)]">{focus.why}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
            Suggested action
          </p>
          <p className="mt-1 text-[14px] leading-6 text-[var(--color-text-secondary)]">{focus.suggested_action}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center rounded-md border border-[var(--color-border)] px-3 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors duration-200 hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]"
        >
          Add as Rule
        </button>
        <AskTradeFiz
          question={focus.ask_question}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90"
        >
          Ask TradeFix AI
        </AskTradeFiz>
      </div>
      {open ? <AddRuleModal ruleName={focus.suggested_rule} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
