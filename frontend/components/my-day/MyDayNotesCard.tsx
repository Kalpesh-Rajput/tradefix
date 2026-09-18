"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { RichNoteEditor } from "@/components/dayview/notes/RichNoteEditor";
import { NotebookTemplatePills } from "@/components/notebook/NotebookTemplatePills";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import {
  SESSION_PLAN_TEMPLATE_ID,
  getNoteTemplate,
  isNoteContentEmpty,
  renderTemplateHtml,
  type NoteTemplate,
} from "@/lib/day-notes/templates";
import { useDayNote, useUpsertDayNote } from "@/lib/hooks/useDayNotes";

export function MyDayNotesCard({ accountId, date }: { accountId: string; date: string }) {
  const toast = useToast();
  const { data: existing, isLoading, isError, refetch } = useDayNote(accountId, date);
  const upsert = useUpsertDayNote();
  const [html, setHtml] = useState("");
  const [templateId, setTemplateId] = useState(SESSION_PLAN_TEMPLATE_ID);
  const [baseline, setBaseline] = useState("");
  const [revision, setRevision] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [open, setOpen] = useState(true);
  const htmlRef = useRef(html);
  const templateRef = useRef(templateId);
  const existingRef = useRef(existing);
  htmlRef.current = html;
  templateRef.current = templateId;
  existingRef.current = existing;

  useEffect(() => {
    if (isLoading) return;
    const nextHtml = existing?.content?.trim()
      ? existing.content
      : renderTemplateHtml(getNoteTemplate(SESSION_PLAN_TEMPLATE_ID));
    setHtml(nextHtml);
    setTemplateId(existing?.template_id || SESSION_PLAN_TEMPLATE_ID);
    setBaseline(nextHtml);
    setHydrated(true);
    setRevision((n) => n + 1);
  }, [existing, isLoading, date, accountId]);

  const dirty = hydrated && html !== baseline;

  const save = useCallback(
    async (opts?: { quiet?: boolean }) => {
      try {
        const note = await upsert.mutateAsync({
          account_id: accountId,
          date,
          content: htmlRef.current,
          template_id: templateRef.current,
          is_favorite: existingRef.current?.is_favorite,
          folder_id: existingRef.current?.folder_id ?? null,
        });
        setBaseline(note.content);
        if (!opts?.quiet) toast.success("Notes saved");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Couldn’t save notes");
      }
    },
    [accountId, date, toast, upsert]
  );

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save({ quiet: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [dirty, html, save]);

  function applyTemplate(template: NoteTemplate) {
    if (!isNoteContentEmpty(html) && html !== renderTemplateHtml(getNoteTemplate(SESSION_PLAN_TEMPLATE_ID))) {
      const ok = window.confirm("Replace the current note with this template? Unsaved wording will be lost.");
      if (!ok) return;
    }
    const next = renderTemplateHtml(template);
    setTemplateId(template.id);
    setHtml(next);
    setRevision((n) => n + 1);
  }

  return (
    <section className="dash-card flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 shrink-0 items-center justify-between gap-2 px-4 text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Notes</h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">Your game plan for today</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[var(--color-text-tertiary)] transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)]">
          {isLoading || !hydrated ? (
            <div className="space-y-3 p-4">
              <div className="h-8 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
              <div className="h-48 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
            </div>
          ) : isError ? (
            <p className="px-4 py-6 text-sm">
              Couldn’t load this day’s notes.{" "}
              <button type="button" className="text-primary" onClick={() => void refetch()}>
                Retry
              </button>
            </p>
          ) : (
            <>
              <div className="px-4 pt-3">
                <NotebookTemplatePills currentId={templateId} onSelect={applyTemplate} />
              </div>
              <RichNoteEditor
                html={html}
                revision={revision}
                onChange={setHtml}
                fullscreen={fullscreen}
                onToggleFullscreen={() => setFullscreen((v) => !v)}
                layout="document"
              />
              <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-2">
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {upsert.isPending ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
                  <span className="mx-1.5">·</span>
                  {getNoteTemplate(templateId).name}
                </p>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={upsert.isPending}
                  className="dash-btn-primary text-on-accent min-w-[72px] disabled:opacity-60"
                >
                  {upsert.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
