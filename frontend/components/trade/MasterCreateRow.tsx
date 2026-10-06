"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MasterCreateRow({
  label,
  query,
  canCreateFromQuery,
  pending,
  uppercase = false,
  onCreate,
}: {
  label: string;
  query: string;
  canCreateFromQuery: boolean;
  pending: boolean;
  uppercase?: boolean;
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const display = uppercase ? trimmed.toUpperCase() : trimmed;
  const noun = label.trim().toLowerCase();

  useEffect(() => {
    if (!composing) return;
    inputRef.current?.focus();
  }, [composing]);

  async function submit(name: string) {
    const created = await onCreate(name);
    if (!created) return;
    setDraft("");
    setComposing(false);
  }

  if (composing) {
    return (
      <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-2.5 py-2">
        <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
        <input
          ref={inputRef}
          value={draft}
          maxLength={100}
          onChange={(event) => setDraft(uppercase ? event.target.value.toUpperCase() : event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setComposing(false);
              setDraft("");
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              void submit(draft);
            }
          }}
          placeholder={`New ${noun}`}
          aria-label={`New ${noun}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2.5 text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-primary/50 focus:shadow-[var(--focus-ring)]"
        />
        <button
          type="button"
          disabled={pending || !draft.trim()}
          onClick={() => void submit(draft)}
          className="h-8 shrink-0 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-on-accent transition-opacity duration-150 disabled:opacity-40"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (canCreateFromQuery && trimmed) void submit(trimmed);
        else setComposing(true);
      }}
      className="flex w-full items-center gap-2 border-t border-[var(--color-border)] px-3 py-2.5 text-left text-xs font-medium text-primary transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] disabled:opacity-50"
    >
      <Plus className="h-3.5 w-3.5" />
      {canCreateFromQuery && display ? `Add “${display}”` : "Add new"}
    </button>
  );
}
