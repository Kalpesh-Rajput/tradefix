"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { REPORT_PNL_MODES } from "@/lib/reports/pnlMode";
import type { ReportPnlMode } from "@/lib/reports/types";

export function PnlModeSelector({
  value,
  onChange,
  compact = false,
}: {
  value: ReportPnlMode;
  onChange: (value: ReportPnlMode) => void;
  compact?: boolean;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const selected = REPORT_PNL_MODES.find((m) => m.id === value) ?? REPORT_PNL_MODES[0];

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 140;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPos({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const panel =
    open && pos
      ? createPortal(
          <ul
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label="P&L showing"
            className="fixed z-[220] w-[140px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: pos.top, left: pos.left }}
          >
            {REPORT_PNL_MODES.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <li key={opt.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={clsx(
                      "flex h-8 w-full items-center px-3 text-[12px] font-medium uppercase tracking-wide outline-none",
                      isSelected
                        ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                    )}
                    onClick={() => {
                      onChange(opt.id);
                      close();
                      triggerRef.current?.focus();
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {compact ? null : (
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          P&L showing
        </span>
      )}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`P&L showing: ${selected.label}`}
        onClick={() => {
          if (open) close();
          else {
            updatePosition();
            setOpen(true);
          }
        }}
        className={clsx(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium uppercase tracking-wide text-[var(--color-text-primary)] outline-none",
          "hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "border-primary/40 ring-2 ring-primary/20"
        )}
      >
        {selected.label}
        <ChevronDown
          className={clsx("h-3.5 w-3.5 text-[var(--color-text-muted)]", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
