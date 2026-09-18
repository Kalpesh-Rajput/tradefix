"use client";

import clsx from "clsx";
import { ChevronDown, Filter, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const SESSIONS = ["", "Asia", "London", "NY", "Overlap"] as const;

const toolbarBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]";

export function ReportsFiltersMenu({
  session,
  symbol,
  onSession,
  onSymbol,
  onClear,
}: {
  session: string;
  symbol: string;
  onSession: (v: string) => void;
  onSymbol: (v: string) => void;
  onClear: () => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const active = Boolean(session || symbol.trim());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={clsx(toolbarBtn, active && "border-primary/30 bg-[var(--color-primary-very-light)]")}
      >
        <Filter className="h-3.5 w-3.5 text-[var(--color-text-muted)]" strokeWidth={1.75} />
        Filters
        {active ? (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
            {[session, symbol.trim()].filter(Boolean).length}
          </span>
        ) : null}
        <ChevronDown
          className={clsx("h-3.5 w-3.5 text-[var(--color-text-muted)]", open && "rotate-180")}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="dialog"
          aria-label="Report filters"
          className="absolute right-0 z-[80] mt-1.5 w-[280px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-dropdown"
        >
          <label className="block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Session
            </span>
            <select
              value={session}
              onChange={(e) => onSession(e.target.value)}
              className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px] text-[var(--color-text-primary)] outline-none focus:border-primary/40"
            >
              {SESSIONS.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "All sessions"}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-2.5 block space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
              Symbol
            </span>
            <input
              value={symbol}
              onChange={(e) => onSymbol(e.target.value)}
              placeholder="e.g. ES"
              className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-primary/40"
            />
          </label>
          {active ? (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-3 w-3" strokeWidth={1.75} />
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
