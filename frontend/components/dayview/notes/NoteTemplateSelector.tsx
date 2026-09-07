"use client";

import { LayoutTemplate } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NOTE_TEMPLATES, type NoteTemplate } from "@/lib/day-notes/templates";

export function NoteTemplateSelector({
  currentId,
  onSelect,
}: {
  currentId: string;
  onSelect: (template: NoteTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
      >
        <LayoutTemplate className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" strokeWidth={1.75} />
        Templates
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-1 w-[280px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]">
          {NOTE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelect(template);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[var(--color-primary-very-light)]"
            >
              <span className="text-[12px] font-medium text-[var(--color-text-primary)]">
                {template.name}
                {template.id === currentId ? (
                  <span className="ml-2 text-[10px] font-normal text-[var(--color-text-muted)]">Current</span>
                ) : null}
              </span>
              <span className="text-[11px] text-[var(--color-text-tertiary)]">{template.description}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
