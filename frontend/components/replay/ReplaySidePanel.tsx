"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { formatCrosshairTime } from "@/components/chart/chartTime";
import type { ReplayNote } from "@/lib/hooks/useReplay";

export function ReplaySidePanel({
  notes,
  timeZone,
  cursorMs,
  saving,
  error,
  onAdd,
  onJump,
}: {
  notes: ReplayNote[];
  timeZone: string;
  cursorMs: number;
  saving: boolean;
  error: string | null;
  onAdd: (text: string) => Promise<void>;
  onJump: (timeMs: number) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(true);

  return (
    <aside className="flex w-full shrink-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:w-72">
      <button
        type="button"
        className="flex h-11 items-center justify-between px-3 text-left text-sm font-medium text-[var(--color-text-primary)] lg:cursor-default"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Notes
        <span className="text-[11px] font-normal text-[var(--color-text-muted)] lg:hidden">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 border-t border-[var(--color-border)] px-3 py-3">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const next = text.trim();
              if (!next || saving) return;
              void onAdd(next).then(() => setText("")).catch(() => {});
            }}
          >
            <label className="text-[11px] text-[var(--color-text-muted)]" htmlFor="replay-note">
              Note at the current replay time
            </label>
            <textarea
              id="replay-note"
              value={text}
              maxLength={2000}
              rows={3}
              onChange={(event) => setText(event.target.value)}
              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]"
            />
            {error ? <p className="text-[11px] text-[var(--color-pnl-negative,var(--color-danger-text))]">{error}</p> : null}
            <Button type="submit" size="sm" disabled={saving || text.trim().length === 0}>
              {saving ? "Saving…" : "Add note"}
            </Button>
          </form>
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto lg:max-h-none lg:flex-1">
            {notes.length === 0 ? <li className="text-xs text-[var(--color-text-muted)]">No notes yet.</li> : null}
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onJump(note.replay_time_ms)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-[var(--color-border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]"
                >
                  <span className="block text-[10px] text-[var(--color-text-muted)]">
                    {formatCrosshairTime(note.replay_time_ms, timeZone)}
                    {note.replay_time_ms > cursorMs ? " · ahead" : ""}
                  </span>
                  <span className="block text-sm text-[var(--color-text-primary)]">{note.text}</span>
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
