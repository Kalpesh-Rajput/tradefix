"use client";

import { SquarePen } from "lucide-react";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";

export function TradeFixAIHistory() {
  const { grouped, conversationId, selectConversation, startNewChat } = useTradeFixAssistant();
  const empty = grouped.length === 0;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--color-surface)]">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">History</p>
        <button
          type="button"
          onClick={startNewChat}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <SquarePen className="h-3.5 w-3.5" strokeWidth={1.75} />
          New chat
        </button>
      </div>
      {empty ? (
        <div className="px-3.5 py-6">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">No conversations yet</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-tertiary)]">
            Questions you ask here show up in TradeFix AI history.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {grouped.map((group) => (
            <section key={group.label} className="mb-3">
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-[var(--color-text-tertiary)]">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(item.id)}
                      className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[12px] leading-4 transition-colors hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        conversationId === item.id
                          ? "bg-[var(--color-primary-very-light)] font-medium text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                      title={item.title}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
