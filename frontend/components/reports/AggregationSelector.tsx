"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AGGREGATION_LABELS } from "@/lib/reports/charts";
import type { ReportAggregation } from "@/lib/reports/types";

const OPTIONS: ReportAggregation[] = ["day", "week", "month"];

export function AggregationSelector({
  value,
  onChange,
}: {
  value: ReportAggregation;
  onChange: (value: ReportAggregation) => void;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 120;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
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
            aria-label="Time aggregation"
            className="fixed z-[220] w-[120px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: pos.top, left: pos.left }}
          >
            {OPTIONS.map((opt) => {
              const selected = opt === value;
              return (
                <li key={opt} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={clsx(
                      "flex h-8 w-full items-center px-3 text-[12px] outline-none",
                      selected
                        ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                    )}
                    onClick={() => {
                      onChange(opt);
                      close();
                      triggerRef.current?.focus();
                    }}
                  >
                    {AGGREGATION_LABELS[opt]}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Aggregation: ${AGGREGATION_LABELS[value]}`}
        onClick={() => {
          if (open) close();
          else {
            updatePosition();
            setOpen(true);
          }
        }}
        className={clsx(
          "inline-flex h-8 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] text-[var(--color-text-secondary)] outline-none",
          "hover:border-[var(--color-border-light)] focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "border-primary/40 ring-2 ring-primary/20"
        )}
      >
        {AGGREGATION_LABELS[value]}
        <ChevronDown className={clsx("h-3.5 w-3.5 text-[var(--color-text-muted)]", open && "rotate-180")} aria-hidden />
      </button>
      {panel}
    </>
  );
}
