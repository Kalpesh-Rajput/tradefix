"use client";

import { TradeFizAIComposer } from "@/components/ai/TradeFizAIComposer";

export function AiInput({
  value,
  onChange,
  onSubmit,
  onStop,
  onPrompt,
  pending = false,
  prompts = [],
  focusTick = 0,
  variant = "page",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onPrompt: (question: string) => void;
  pending?: boolean;
  prompts?: { id: string; title: string; question: string }[];
  focusTick?: number;
  variant?: "page" | "drawer";
}) {
  const drawer = variant === "drawer";

  return (
    <div className={drawer ? "px-3 py-3" : "bg-[var(--color-surface)] px-3 py-3 sm:px-0"}>
      <TradeFizAIComposer
        variant={drawer ? "compact" : "full"}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        onStop={onStop}
        loading={pending}
        focusTick={focusTick}
        prompts={prompts.map((prompt) => ({ label: prompt.title, question: prompt.question }))}
        onPrompt={onPrompt}
      />
    </div>
  );
}
