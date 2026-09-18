"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { PLAYBOOK_CATEGORIES } from "@/lib/playbooks/types";
import type { PlaybookCreateInput, UserPlaybook } from "@/lib/playbooks/types";

export function PlaybookFormModal({
  open,
  title,
  initial,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: Partial<UserPlaybook>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: PlaybookCreateInput) => void;
}) {
  const titleId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [style, setStyle] = useState(initial?.rules?.style ?? "");
  const [entry, setEntry] = useState((initial?.rules?.entry ?? []).join("\n"));
  const [confirmation, setConfirmation] = useState((initial?.rules?.confirmation ?? []).join("\n"));
  const [risk, setRisk] = useState((initial?.rules?.risk ?? []).join("\n"));
  const [exitRules, setExitRules] = useState((initial?.rules?.exit ?? []).join("\n"));
  const [notes, setNotes] = useState(initial?.rules?.notes ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [checklist, setChecklist] = useState((initial?.checklist ?? []).map((i) => i.label).join("\n"));
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStyle(initial?.rules?.style ?? "");
    setEntry((initial?.rules?.entry ?? []).join("\n"));
    setConfirmation((initial?.rules?.confirmation ?? []).join("\n"));
    setRisk((initial?.rules?.risk ?? []).join("\n"));
    setExitRules((initial?.rules?.exit ?? []).join("\n"));
    setNotes(initial?.rules?.notes ?? "");
    setTags((initial?.tags ?? []).join(", "));
    setChecklist((initial?.checklist ?? []).map((i) => i.label).join("\n"));
    setCategories(initial?.categories ?? []);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
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

  function lines(value: string) {
    return value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(720px,90vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || submitting) return;
          onSubmit({
            name: name.trim(),
            description: description.trim(),
            categories,
            tags: tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            rules: {
              style: style.trim(),
              entry: lines(entry),
              confirmation: lines(confirmation),
              risk: lines(risk),
              exit: lines(exitRules),
              notes: notes.trim(),
            },
            checklist: lines(checklist).map((label) => ({ label })),
          });
        }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
          <h2 id={titleId} className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-[var(--color-text-muted)]" aria-label="Close">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <Label>Playbook name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-medium text-[var(--color-text-secondary)]">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {PLAYBOOK_CATEGORIES.map((cat) => {
                const on = categories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setCategories((curr) => (curr.includes(cat.id) ? curr.filter((c) => c !== cat.id) : [...curr, cat.id]))
                    }
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      on
                        ? "border-primary/30 bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Setup type</Label>
            <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="Intraday, swing…" />
          </div>
          <div>
            <Label>Entry criteria</Label>
            <Textarea rows={3} value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="One rule per line" />
          </div>
          <div>
            <Label>Confirmation criteria</Label>
            <Textarea rows={3} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="One rule per line" />
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="liquidity, session…" />
          </div>
          <div>
            <Label>Risk rules</Label>
            <Textarea rows={3} value={risk} onChange={(e) => setRisk(e.target.value)} />
          </div>
          <div>
            <Label>Exit criteria</Label>
            <Textarea rows={3} value={exitRules} onChange={(e) => setExitRules(e.target.value)} />
          </div>
          <div>
            <Label>Confirmation checklist</Label>
            <Textarea rows={3} value={checklist} onChange={(e) => setChecklist(e.target.value)} placeholder="One item per line" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || submitting}>
            {submitting ? "Saving…" : "Save playbook"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
