"use client";

import clsx from "clsx";
import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatRangeLabel(from: string, to: string) {
  const fmt = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  if (!from || !to) return "Select dates";
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

function normalizeRange(from: string, to: string) {
  if (!from || !to) return { from, to };
  if (from > to) return { from: to, to: from };
  return { from, to };
}

type PresetId =
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "ytd"
  | "all";

function rangeForPreset(id: PresetId): { from: string; to: string } {
  const today = startOfDay(new Date());
  const to = localIso(today);

  if (id === "7d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: localIso(from), to };
  }
  if (id === "30d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: localIso(from), to };
  }
  if (id === "90d") {
    const from = new Date(today);
    from.setDate(from.getDate() - 89);
    return { from: localIso(from), to };
  }
  if (id === "this_month") {
    return { from: localIso(new Date(today.getFullYear(), today.getMonth(), 1)), to };
  }
  if (id === "last_month") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: localIso(first), to: localIso(last) };
  }
  if (id === "ytd") {
    return { from: localIso(new Date(today.getFullYear(), 0, 1)), to };
  }
  // all time — far enough back for journal history
  return { from: "2015-01-01", to };
}

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "ytd", label: "Year to date" },
  { id: "all", label: "All time" },
];

export function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
  className,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const todayIso = localIso(startOfDay(new Date()));

  useEffect(() => {
    if (!open) return;
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
  }, [open, dateFrom, dateTo]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activePreset = useMemo(() => {
    return PRESETS.find((p) => {
      const r = rangeForPreset(p.id);
      return r.from === dateFrom && r.to === dateTo;
    })?.id;
  }, [dateFrom, dateTo]);

  function apply(from: string, to: string) {
    const next = normalizeRange(from, to);
    if (!next.from || !next.to) return;
    onChange(next.from, next.to);
    setOpen(false);
  }

  function applyPreset(id: PresetId) {
    const r = rangeForPreset(id);
    setDraftFrom(r.from);
    setDraftTo(r.to);
    apply(r.from, r.to);
  }

  function resetDefault() {
    const r = rangeForPreset("30d");
    apply(r.from, r.to);
  }

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 min-w-[210px] max-w-[280px] items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-left">{formatRangeLabel(dateFrom, dateTo)}</span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform duration-150",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label="Select date range"
          className="absolute right-0 z-50 mt-1.5 w-[320px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-dropdown"
        >
          <div className="border-b border-[var(--color-border-light)] px-3 py-2">
            <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">Quick ranges</p>
            <ul className="mt-1.5 grid grid-cols-2 gap-1">
              {PRESETS.map((preset) => {
                const selected = activePreset === preset.id;
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={clsx(
                        "flex h-8 w-full items-center justify-between gap-1 rounded-md px-2 text-left text-[11px] transition-colors duration-150",
                        selected
                          ? "bg-[var(--color-primary-light)] font-medium text-primary"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
                      )}
                    >
                      <span className="truncate">{preset.label}</span>
                      {selected && <Check className="h-3 w-3 shrink-0" strokeWidth={2.25} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2.5 px-3 py-3">
            <p className="text-[11px] font-medium text-[var(--color-text-secondary)]">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  From
                </span>
                <input
                  type="date"
                  value={draftFrom}
                  max={draftTo || todayIso}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text-primary)] outline-none transition focus:border-primary/40"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  To
                </span>
                <input
                  type="date"
                  value={draftTo}
                  min={draftFrom || undefined}
                  max={todayIso}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text-primary)] outline-none transition focus:border-primary/40"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={resetDefault}
                className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-3 w-3" strokeWidth={1.75} />
                Reset
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="dash-btn-secondary !h-8 !px-3 !text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!draftFrom || !draftTo}
                  onClick={() => apply(draftFrom, draftTo)}
                  className="dash-btn-primary text-on-accent !h-8 !px-3 !text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
