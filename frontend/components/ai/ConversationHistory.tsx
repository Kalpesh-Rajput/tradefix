"use client";

import clsx from "clsx";

import type { ThreadMessage } from "@/components/ai/types";

export function ConversationHistory({
  messages,
  activeId,
  onSelect,
  variant = "sidebar",
  showEmpty = false,
}: {
  messages: ThreadMessage[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  variant?: "sidebar" | "strip";
  showEmpty?: boolean;
}) {
  const questions = messages.filter((message) => message.role === "user");
  if (questions.length === 0 && !showEmpty) return null;

  if (variant === "strip") {
    return (
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[var(--color-border)] px-3 py-2 lg:hidden">
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          History
        </p>
        {questions.length === 0 ? (
          <span className="text-[12px] text-[var(--color-text-tertiary)]">No questions yet</span>
        ) : (
          questions.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => onSelect(message.id)}
              title={message.text}
              className={clsx(
                "max-w-[180px] shrink-0 truncate rounded-full border px-2.5 py-1 text-[12px]",
                activeId === message.id
                  ? "border-primary/30 bg-[var(--color-primary-very-light)] font-medium text-[var(--color-text-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              )}
            >
              {message.text}
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
      <div className="px-3 pb-2 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          Chat history
        </p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Conversation questions">
        {questions.length === 0 ? (
          <p className="px-2.5 text-[12px] leading-5 text-[var(--color-text-tertiary)]">
            Questions you ask in this conversation show up here.
          </p>
        ) : (
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
        )}
      </nav>
    </aside>
  );
}
