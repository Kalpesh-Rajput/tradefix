"use client";

import { BookOpen, LayoutGrid, Plus } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function CreatePlaybookModal({
  open,
  onClose,
  onScratch,
  onBrowse,
}: {
  open: boolean;
  onClose: () => void;
  onScratch: () => void;
  onBrowse: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[440px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-dropdown)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Create new playbook
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onScratch}
            className="flex w-full items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-left transition-colors hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]"
          >
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary-very-light)] text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-[var(--color-text-primary)]">Create from scratch</span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">
                Build your own custom trading playbook.
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onBrowse}
            className="flex w-full items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-left transition-colors hover:border-primary/30 hover:bg-[var(--color-primary-very-light)]"
          >
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary-very-light)] text-primary">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-[var(--color-text-primary)]">
                Browse playbook templates
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">
                Use a template — a faster way to start.
              </span>
            </span>
            <BookOpen className="ml-auto mt-1 h-4 w-4 text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
