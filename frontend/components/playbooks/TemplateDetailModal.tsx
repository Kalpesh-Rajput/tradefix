"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { TemplatePreview } from "@/components/playbooks/TemplatePreview";
import { CATEGORY_LABEL } from "@/lib/playbooks/types";
import type { PlaybookTemplate } from "@/lib/playbooks/types";

export function TemplateDetailModal({
  template,
  added,
  adding,
  onClose,
  onAdd,
  onView,
}: {
  template: PlaybookTemplate | null;
  added: boolean;
  adding?: boolean;
  onClose: () => void;
  onAdd: () => void;
  onView?: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!template) return;
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
  }, [template, onClose]);

  if (!template || typeof document === "undefined") return null;
  const rules = template.rules || {};

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(760px,92vh)] w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
      >
        <div className="shrink-0">
          <TemplatePreview icon={template.icon} title={template.title} seed={template.slug} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-[18px] font-semibold text-[var(--color-text-primary)]">
                {template.icon ? `${template.icon} ` : ""}
                {template.title}
              </h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{template.description}</p>
            </div>
            <button type="button" onClick={onClose} className="text-[var(--color-text-muted)]" aria-label="Close">
              ×
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {template.categories.map((id) => (
              <span key={id} className="rounded-md bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                {CATEGORY_LABEL[id] ?? id}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
            Starter template · {template.creator_name} · v{template.version}
          </p>
          <Section title="Entry criteria" items={rules.entry} />
          <Section title="Confirmation" items={rules.confirmation} />
          <Section title="Risk management" items={rules.risk} />
          <Section title="Exit rules" items={rules.exit} />
          {template.checklist?.length ? (
            <div className="mt-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Checklist</h3>
              <ul className="mt-2 space-y-1.5">
                {template.checklist.map((item) => (
                  <li key={item.id} className="text-[13px] text-[var(--color-text-secondary)]">
                    ☐ {item.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {rules.notes ? <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">{rules.notes}</p> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          {added ? (
            <Button type="button" onClick={onView}>
              View playbook
            </Button>
          ) : (
            <Button type="button" disabled={adding} onClick={onAdd}>
              {adding ? "Adding…" : "Add to My Playbooks"}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-[var(--color-text-secondary)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
