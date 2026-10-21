"use client";

import { ChevronDown, NotebookPen } from "lucide-react";
import { useState } from "react";

import { formatCrosshairTime } from "@/components/chart/chartTime";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api";
import type { ReplayNote } from "@/lib/hooks/useReplay";

export function ReplaySidePanel({
  notes,
  timeZone,
  cursorMs,
  saving,
  loading,
  loadFailed,
  persistent,
  error,
  onAdd,
  onJump,
  onReload,
}: {
  notes: ReplayNote[];
  timeZone: string;
  cursorMs: number;
  saving: boolean;
  loading: boolean;
  loadFailed: boolean;
  persistent: boolean;
  error: string | null;
  onAdd: (text: string) => Promise<void>;
  onJump: (timeMs: number) => void;
  onReload: () => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);
  const ordered = [...notes].sort((a, b) => a.replay_time_ms - b.replay_time_ms);

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:w-72" aria-label="Replay notes">
      <button
        type="button"
        className="flex h-11 items-center justify-between gap-2 px-3 text-left text-sm font-semibold text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-hex)]"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-[var(--accent-hex)]" aria-hidden />
          Notes
          {notes.length > 0 ? (
            <span className="rounded-full border border-[var(--color-border)] px-1.5 font-mono text-[10px] font-normal tabular-nums text-[var(--color-text-muted)]">{notes.length}</span>
          ) : null}
        </span>
        <ChevronDown className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`} aria-hidden />
      </button>
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-[var(--color-border)] px-3 py-3">
          {persistent ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const next = text.trim();
                if (!next || saving) return;
                void onAdd(next).then(() => setText("")).catch(() => {});
              }}
            >
              <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]" htmlFor="replay-note">
                <span>Note at replay time</span>
                <span className="font-medium tabular-nums text-[var(--color-text-secondary)]">{formatCrosshairTime(cursorMs, timeZone)}</span>
              </label>
              <textarea
                id="replay-note"
                value={text}
                maxLength={2000}
                rows={3}
                placeholder="What do you see at this candle?"
                onChange={(event) => setText(event.target.value)}
                className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-sm text-[var(--color-text-primary)] transition-colors placeholder:text-[var(--color-text-muted)] hover:border-[var(--accent-hex)]/40 focus-visible:border-[var(--accent-hex)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]/30 motion-reduce:transition-none"
              />
              {error ? (
                <p role="alert" className="text-[11px] text-[var(--color-pnl-negative,var(--color-danger-text))]">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">{text.length}/2000</span>
                <button
                  type="submit"
                  disabled={saving || text.trim().length === 0}
                  className="inline-flex h-8 items-center rounded-md bg-[var(--accent-hex)] px-3 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                >
                  {saving ? "Saving…" : "Add note"}
                </button>
              </div>
            </form>
          ) : (
            <p className="rounded-md bg-[var(--color-border-subtle)] px-2.5 py-2 text-xs text-[var(--color-text-muted)]">
              Notes are saved against logged journal trades. This simulated replay has no journal trade to attach them to.
            </p>
          )}
          <ul className="flex max-h-64 flex-col divide-y divide-[var(--color-border)] overflow-y-auto lg:max-h-none lg:flex-1" aria-busy={loading}>
            {loading ? (
              <>
                <li className="py-2"><Skeleton className="h-10" /></li>
                <li className="py-2"><Skeleton className="h-10" /></li>
              </>
            ) : null}
            {loadFailed ? (
              <li className="py-2 text-xs text-[var(--color-text-muted)]">
                Couldn’t load notes.{" "}
                <button type="button" onClick={onReload} className="font-medium text-[var(--accent-hex)] hover:underline">
                  Retry
                </button>
              </li>
            ) : null}
            {!loading && !loadFailed && persistent && ordered.length === 0 ? (
              <li className="py-2 text-xs text-[var(--color-text-muted)]">No notes yet. Notes you add are pinned to the candle time.</li>
            ) : null}
            {ordered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onJump(note.replay_time_ms)}
                  title="Jump to this time"
                  className="w-full rounded-md px-1.5 py-2 text-left transition-colors hover:bg-[var(--color-border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)] motion-reduce:transition-none"
                >
                  <span className="block text-[10px] font-medium tabular-nums text-[var(--accent-hex)]">
                    {formatCrosshairTime(note.replay_time_ms, timeZone)}
                    {note.replay_time_ms > cursorMs ? " · ahead of replay" : ""}
                  </span>
                  <span className="mt-0.5 block whitespace-pre-wrap break-words text-sm text-[var(--color-text-primary)]">{note.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}

export function noteError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not save the note.";
}
