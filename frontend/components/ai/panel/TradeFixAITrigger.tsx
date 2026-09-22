"use client";

import clsx from "clsx";

import { AiMark } from "@/components/ai/AiMark";
import { useJournalAi } from "@/components/ai/panel/JournalAiContext";

export function TradeFixAITrigger() {
  const { open, toggle } = useJournalAi();

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-label="Ask TradeFix AI"
        aria-expanded={open}
        aria-controls="tradefix-ai-panel"
        title="Ask TradeFix AI"
        className={clsx(
          "ai-trigger-glow inline-flex h-8 w-8 items-center justify-center rounded-full transition duration-200",
          "hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          open && "scale-105"
        )}
      >
        <AiMark size={32} pulse={!open} />
      </button>
      {open ? null : (
      <span
        role="tooltip"
        className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-20 whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        Ask TradeFix AI
      </span>
      )}
    </div>
  );
}
