"use client";

import { tradefizPromptPillClass } from "@/components/ai/TradeFizAIComposer";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";

export function TradeFixAIQuickPrompts() {
  const { prompts, pending, ask } = useTradeFixAssistant();

  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          disabled={pending}
          onClick={() => ask(prompt.question)}
          className={tradefizPromptPillClass}
        >
          {prompt.label}
        </button>
      ))}
    </div>
  );
}
