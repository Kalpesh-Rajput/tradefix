"use client";

import clsx from "clsx";

import type { ThreadMessage } from "@/components/ai/types";

export function ConversationHistory({
  messages,
  activeId,
  onSelect,
}: {
  messages: ThreadMessage[];
  activeId?: string | null;
  onSelect: (id: string) => void;
}) {
  const questions = messages.filter((message) => message.role === "user");
  if (questions.length === 0) return null;

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
      <div className="px-3 pb-2 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          Today
        </p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Conversation questions">
        <ul className="space-y-0.5">
          {questions.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => onSelect(message.id)}
                className={clsx(
                  "w-full truncate rounded-lg px-2.5 py-2 text-left text-[12px] leading-4 text-[var(--color-text-secondary)] transition-colors duration-150",
                  "hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]",
                  "motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  activeId === message.id && "bg-[var(--color-primary-very-light)] font-medium text-[var(--color-text-primary)]"
                )}
                title={message.text}
              >
                {message.text}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
