"use client";

import clsx from "clsx";
import { History, Maximize2, Minimize2, X } from "lucide-react";

import { AiMark } from "@/components/ai/AiMark";
import { useJournalAi } from "@/components/ai/panel/JournalAiContext";

const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function TradeFixAIHeader() {
  const { pending, fullscreen, historyOpen, close, toggleFullscreen, toggleHistory } = useJournalAi();

  return (
    <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--color-border)] px-3.5 py-3">
      <AiMark size={34} pulse={pending} />
      <div className="min-w-0 flex-1">
        <h2 id="tradefix-ai-title" className="truncate text-[14px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          TradeFix AI
        </h2>
        <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">Your trading coach</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={toggleHistory}
          aria-label="Conversation history"
          aria-expanded={historyOpen}
          title="History"
          className={clsx(iconBtn, historyOpen && "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]")}
        >
          <History className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-pressed={fullscreen}
          title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          className={clsx(iconBtn, "max-md:!hidden")}
        >
          {fullscreen ? <Minimize2 className="h-4 w-4" strokeWidth={1.75} /> : <Maximize2 className="h-4 w-4" strokeWidth={1.75} />}
        </button>
        <button type="button" onClick={close} aria-label="Close TradeFix AI" title="Close" className={iconBtn}>
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
