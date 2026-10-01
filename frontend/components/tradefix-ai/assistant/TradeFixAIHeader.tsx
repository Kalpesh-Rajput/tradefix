"use client";

import clsx from "clsx";
import { ArrowUpRight, History, Minus, X } from "lucide-react";
import Image from "next/image";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";

const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function TradeFixAIHeader() {
  const { historyOpen, close, toggleHistory, openFull } = useTradeFixAssistant();

  return (
    <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--color-border)] px-3.5 py-2.5">
      <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <h2 id="tradefix-ai-widget-title" className="truncate text-[14px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          TradeFix AI
        </h2>
        <p className="truncate text-[12px] text-[var(--color-text-tertiary)]">Your trading intelligence</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={openFull}
          aria-label="Open full TradeFix AI"
          title="Open full TradeFix AI"
          className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[12px] font-medium text-primary transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Open full AI</span>
        </button>
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
        <button type="button" onClick={close} aria-label="Minimize TradeFix AI" title="Minimize" className={iconBtn}>
          <Minus className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={close} aria-label="Close TradeFix AI" title="Close" className={iconBtn}>
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
