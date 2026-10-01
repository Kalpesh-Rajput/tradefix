"use client";

import { Target } from "lucide-react";
import { useState } from "react";

import { AskTradeFixAI } from "@/components/tradefix-ai/assistant/AskTradeFixAI";
import type { AiInsightFocus } from "@/lib/types";

import { AddRuleModal } from "./AddRuleModal";

export function FocusCard({ focus }: { focus: AiInsightFocus }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="dash-card p-3.5 sm:p-4">
      <div className="flex h-6 items-center gap-1.5">
        <Target className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
        <h2 className="text-[12px] font-medium text-[var(--color-text-primary)]">Your Focus</h2>
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-5 text-[var(--color-text-primary)]">{focus.title}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        Why
      </p>
      <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{focus.why}</p>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        Suggested action
      </p>
      <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{focus.suggested_action}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
        >
          Add as Rule
        </button>
        <AskTradeFixAI
          question={focus.ask_question}
          className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
        >
          Ask TradeFix AI
        </AskTradeFixAI>
      </div>
      {open ? <AddRuleModal ruleName={focus.suggested_rule} onClose={() => setOpen(false)} /> : null}
    </section>
  );
}
