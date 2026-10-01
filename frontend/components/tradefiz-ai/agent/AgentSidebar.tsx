"use client";

import clsx from "clsx";
import { SquarePen, X } from "lucide-react";

import { AiMark } from "@/components/ai/AiMark";

import { useTradeFizAgent } from "./TradeFizAgentProvider";

export function AgentSidebar({
  className,
  activeId,
  onNew,
  onSelect,
  onClose,
}: {
  className?: string;
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onClose?: () => void;
}) {
  const { grouped } = useTradeFizAgent();

  return (
    <aside className={clsx("flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-background)]", className)}>
      <div className="px-3 pb-2 pt-4">
        <div className="flex items-center gap-2.5 px-1">
          <AiMark size={28} />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">TradeFix AI</p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat history"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onNew}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]"
        >
          <SquarePen className="h-3.5 w-3.5" strokeWidth={1.75} />
          New conversation
        </button>
      </div>
      <div className="px-4 pb-1 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Chat history</p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Chat history">
        {grouped.length === 0 ? (
          <p className="px-2.5 text-[12px] leading-5 text-[var(--color-text-tertiary)]">Your questions will show up here.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-[var(--color-text-tertiary)]">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const selected = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-current={selected ? "true" : undefined}
                        title={item.title}
                        className={clsx(
                          "w-full truncate rounded-[10px] px-3 py-2.5 text-left text-[13px] leading-5 transition-colors duration-150",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "bg-[var(--color-primary-very-light)] font-medium text-primary"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
                        )}
                      >
                        {item.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
