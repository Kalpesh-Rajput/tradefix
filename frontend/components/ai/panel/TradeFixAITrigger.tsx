"use client";

import clsx from "clsx";

import { AiMark } from "@/components/ai/AiMark";
import { useTradeFixAssistant } from "@/components/tradefix-ai/assistant/TradeFixAssistantProvider";

export function TradeFixAITrigger() {
  const { open, toggle } = useTradeFixAssistant();

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label="Ask TradeFix AI"
        aria-expanded={open}
        aria-controls="tradefix-ai-widget"
        title="Ask TradeFix AI"
        className={clsx(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition duration-200",
          "hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          open && "scale-105"
        )}
      >
        <AiMark size={32} />
      </button>
    </div>
  );
}
