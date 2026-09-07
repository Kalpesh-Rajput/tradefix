"use client";

import { ExternalLink, MoreHorizontal, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DaySummaryCard } from "@/components/dayview/notes/DaySummaryCard";
import { NoteTemplateSelector } from "@/components/dayview/notes/NoteTemplateSelector";
import { RichNoteEditor } from "@/components/dayview/notes/RichNoteEditor";
import { ScreenshotGrid } from "@/components/media/ScreenshotGrid";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  DEFAULT_TEMPLATE_ID,
  defaultNoteHtml,
  getNoteTemplate,
  isNoteContentEmpty,
  renderTemplateHtml,
  type NoteTemplate,
} from "@/lib/day-notes/templates";
import { useDayNote, useDeleteDayNote, useDeleteDayNoteScreenshot, usePatchDayNote, useUploadDayNoteScreenshot, useUpsertDayNote } from "@/lib/hooks/useDayNotes";

export type DayNoteTarget = {
  date: string;
  title: string;
  pnl: number;
  trades: number;
  winRate: number;
};

export function DayNoteEditor({
  accountId,
  target,
  formatMoney,
  onClose,
  onDirtyChange,
  variant = "modal",
}: {
  accountId: string;
  target: DayNoteTarget;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  onClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  variant?: "modal" | "page";
}) {
  const toast = useToast();
  const router = useRouter();
  const date = target.date.slice(0, 10);
  const { data: existing, isLoading, isError, refetch } = useDayNote(accountId, date);
  const upsert = useUpsertDayNote();
  const patch = usePatchDayNote();
  const remove = useDeleteDayNote();
  const uploadShot = useUploadDayNoteScreenshot();
  const deleteShot = useDeleteDayNoteScreenshot();

  const [html, setHtml] = useState("");
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [favorite, setFavorite] = useState(false);
  const [baseline, setBaseline] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [revision, setRevision] = useState(0);
  const [mounted, setMounted] = useState(false);
  const dirtyRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = hydrated && html !== baseline;
  dirtyRef.current = dirty;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const nextHtml = existing?.content?.trim() ? existing.content : defaultNoteHtml();
    const nextTemplate = existing?.template_id || DEFAULT_TEMPLATE_ID;
    setHtml(nextHtml);
    setTemplateId(nextTemplate);
    setFavorite(Boolean(existing?.is_favorite));
    setBaseline(nextHtml);
    setHydrated(true);
    setRevision((n) => n + 1);
  }, [existing, isLoading, date, accountId]);

  const saving = upsert.isPending || patch.isPending;

  const save = useCallback(async (opts?: { quiet?: boolean }) => {
    try {
      const note = await upsert.mutateAsync({
        account_id: accountId,
        date,
        content: html,
        template_id: templateId,
        is_favorite: favorite,
      });
      setBaseline(html);
      if (!opts?.quiet) toast.success("Note saved");
      return note;
    } catch (err) {
      toast.error("Couldn’t save note", err instanceof Error ? err.message : undefined);
      return null;
    }
  }, [accountId, date, favorite, html, templateId, toast, upsert]);

  function applyTemplate(template: NoteTemplate) {
    if (!isNoteContentEmpty(html) && html !== defaultNoteHtml()) {
      const ok = window.confirm("Replace the current note with this template? Unsaved wording will be lost.");
      if (!ok) return;
    }
    const next = renderTemplateHtml(template);
    setTemplateId(template.id);
    setHtml(next);
    setRevision((n) => n + 1);
  }

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard unsaved changes?")) return;
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (variant !== "modal") return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (menuOpen) {
        setMenuOpen(false);
        return;
      }
      if (fullscreen) {
        setFullscreen(false);
        return;
      }
      requestClose();
    }
    document.addEventListener("keydown", onKey);
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [variant, fullscreen, menuOpen, requestClose]);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    if (existing) {
      try {
        await patch.mutateAsync({ id: existing.id, is_favorite: next });
      } catch {
        setFavorite(!next);
        toast.error("Couldn’t update favorite");
      }
    }
  }

  async function openNotebook() {
    let noteId = existing?.id;
    if (dirty || !existing) {
      const saved = await save();
      if (!saved) return;
      noteId = saved.id;
    }
    const params = new URLSearchParams({ tab: "daily", date });
    if (noteId) params.set("note", noteId);
    router.push(`/notebook?${params.toString()}`);
    onClose?.();
  }

  async function handleAddScreenshots(files: FileList | File[]) {
    const list = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(f.type)
    );
    if (!list.length) {
      toast.error("Use PNG, JPG, or WEBP");
      return;
    }
    let note = existing;
    if (!note || dirty) {
      const saved = await save({ quiet: Boolean(existing) && dirty });
      if (!saved) return;
      note = saved;
    }
    const room = 5 - (note.screenshot_urls?.length ?? 0);
    if (room <= 0) {
      toast.info("Maximum 5 screenshots");
      return;
    }
    try {
      for (const file of list.slice(0, room)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error("Image must be 5MB or smaller");
          continue;
        }
        await uploadShot.mutateAsync({ id: note.id, file });
      }
      toast.success("Screenshot added");
    } catch (err) {
      toast.error("Couldn’t upload screenshot", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleDeleteScreenshot(url: string) {
    if (!existing) return;
    try {
      await deleteShot.mutateAsync({ id: existing.id, url });
      toast.success("Screenshot removed");
    } catch (err) {
      toast.error("Couldn’t delete screenshot", err instanceof Error ? err.message : undefined);
    }
  }

  async function deleteNote() {
    if (!existing) {
      setHtml(defaultNoteHtml());
      setRevision((n) => n + 1);
      setMenuOpen(false);
      return;
    }
    if (!window.confirm("Delete this day’s note?")) return;
    try {
      await remove.mutateAsync({ id: existing.id, accountId });
      toast.success("Note deleted");
      setMenuOpen(false);
      onClose?.();
    } catch (err) {
      toast.error("Couldn’t delete note", err instanceof Error ? err.message : undefined);
    }
  }

  const editor = (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[var(--color-surface)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
        <h2 id="day-note-title" className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          Day view
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <NoteTemplateSelector currentId={templateId} onSelect={applyTemplate} />
          {variant === "modal" ? (
            <button
              type="button"
              onClick={() => void openNotebook()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            >
              View in Notebook
              <ExternalLink className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void toggleFavorite()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
            aria-label={favorite ? "Unstar note" : "Star note"}
          >
            <Star
              className="h-4 w-4"
              strokeWidth={1.75}
              fill={favorite ? "currentColor" : "none"}
              style={favorite ? { color: "#F3C623" } : undefined}
            />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
              aria-label="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-30 mt-1 w-36 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]">
                <button
                  type="button"
                  onClick={() => void deleteNote()}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-negative hover:bg-[var(--color-danger-bg)]"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </header>

      {isLoading || !hydrated ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 sm:px-5">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : isError ? (
        <div className="mx-4 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm sm:mx-5">
          Couldn’t load this note.{" "}
          <button type="button" onClick={() => void refetch()} className="text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pb-3 sm:px-5">
            <DaySummaryCard
              title={target.title}
              pnl={target.pnl}
              trades={target.trades}
              winRate={target.winRate}
              formatMoney={formatMoney}
            />
          </div>
          <RichNoteEditor
            html={html}
            revision={revision}
            onChange={setHtml}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((v) => !v)}
          />
          <div className="max-h-[38%] shrink-0 overflow-y-auto overscroll-contain border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void handleAddScreenshots(e.target.files);
                e.target.value = "";
              }}
            />
            <ScreenshotGrid
              urls={existing?.screenshot_urls ?? []}
              max={5}
              uploading={uploadShot.isPending}
              canAdd={!uploadShot.isPending && !saving}
              onAdd={() => fileRef.current?.click()}
              onDelete={(url) => void handleDeleteScreenshot(url)}
              emptyHint={existing ? "Add a chart screenshot" : "Save this note to attach screenshots — or add one now"}
            />
          </div>
          <div className="flex shrink-0 justify-end border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="dash-btn-primary text-on-accent min-w-[72px] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
      <p className="sr-only">{getNoteTemplate(templateId).name}</p>
    </div>
  );

  if (variant === "page") {
    return <div className="flex h-full min-h-0 flex-1 flex-col bg-[var(--color-surface)]">{editor}</div>;
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close note"
        onClick={requestClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-note-title"
        tabIndex={-1}
        className="relative z-10 flex h-[90vh] max-h-[calc(100dvh-1.5rem)] w-[62vw] max-w-[960px] flex-col overflow-hidden overscroll-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_56px_rgba(20,20,30,0.22)] outline-none"
      >
        {editor}
      </div>
    </div>,
    document.body
  );
}
