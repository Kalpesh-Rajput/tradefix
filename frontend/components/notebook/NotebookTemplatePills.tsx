"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

import { TEMPLATE_RECENT_KEY } from "@/components/notebook/types";
import { NOTE_TEMPLATES, type NoteTemplate } from "@/lib/day-notes/templates";

export function NotebookTemplatePills({
  currentId,
  onSelect,
}: {
  currentId: string;
  onSelect: (template: NoteTemplate) => void;
}) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TEMPLATE_RECENT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) setRecent(parsed.filter((id) => typeof id === "string"));
    } catch {
      /* ignore */
    }
  }, []);

  const templates = useMemo(() => {
    return [...NOTE_TEMPLATES].sort((a, b) => {
      const ia = recent.indexOf(a.id);
      const ib = recent.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.order - b.order;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [recent]);

  function choose(template: NoteTemplate) {
    const next = [template.id, ...recent.filter((id) => id !== template.id)].slice(0, 8);
    setRecent(next);
    try {
      window.localStorage.setItem(TEMPLATE_RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    onSelect(template);
  }

  return (
    <div>
      <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">Recently used templates</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            title={template.description}
            onClick={() => choose(template)}
            className={clsx(
              "inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium",
              template.id === currentId
                ? "border-primary/30 bg-[var(--color-primary-light)] text-primary"
                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            )}
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  );
}
