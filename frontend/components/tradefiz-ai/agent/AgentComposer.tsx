"use client";

import { TradeFizAIComposer } from "@/components/ai/TradeFizAIComposer";
import { AGENT_STARTERS } from "@/components/ai/suggestions";

export function AgentComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  onPrompt,
  pending,
  focusTick,
  showPrompts,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onPrompt: (question: string) => void;
  pending: boolean;
  focusTick: number;
  showPrompts: boolean;
}) {
  return (
    <div className="shrink-0 bg-[var(--color-surface)] pb-[max(16px,env(safe-area-inset-bottom))] pt-2 sm:pb-[max(20px,env(safe-area-inset-bottom))]">
      <TradeFizAIComposer
        variant="full"
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        onStop={onStop}
        loading={pending}
        focusTick={focusTick}
        prompts={
          showPrompts ? AGENT_STARTERS.map((prompt) => ({ label: prompt, question: prompt })) : undefined
        }
        onPrompt={onPrompt}
      />
    </div>
  );
}
