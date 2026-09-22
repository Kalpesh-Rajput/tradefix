"use client";

import { SquarePen } from "lucide-react";

import { useJournalAi } from "@/components/ai/panel/JournalAiContext";

export function TradeFixAIHistory() {
  const { thread, activeId, setActiveId, toggleHistory, startNewChat } = useJournalAi();
  const questions = thread.filter((message) => message.role === "user");

  function select(id: string) {
    setActiveId(id);
    toggleHistory();
    requestAnimationFrame(() => {
      document.getElementById(`ai-panel-msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--color-surface)]">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          This conversation
        </p>
        {thread.length > 0 ? (
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <SquarePen className="h-3.5 w-3.5" strokeWidth={1.75} />
            New chat
          </button>
        ) : null}
      </div>
      {questions.length === 0 ? (
        <div className="px-3.5 py-6">
          <p className="text-[13px] font-medium text-[var(--color-text-primary)]">No questions yet</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-tertiary)]">
            Questions you ask in this conversation will show up here. Closing the panel keeps the thread.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {questions.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => select(message.id)}
                className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[12px] leading-4 transition-colors hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  activeId === message.id
                    ? "bg-[var(--color-primary-very-light)] font-medium text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
                title={message.text}
              >
                {message.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
