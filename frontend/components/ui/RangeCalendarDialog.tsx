"use client";

import clsx from "clsx";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronRight } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface CalendarPreset {
  id: string;
  label: string;
  resolve: (() => { from: string; to: string }) | null;
}

interface Draft {
  id: string;
  from: string;
  to: string;
}

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function pretty(value: string) {
  const date = parseIso(value);
  return date ? format(date, "d MMMM yyyy") : "Select date";
}

function matchPreset(from: string, to: string, presets: CalendarPreset[]) {
  for (const preset of presets) {
    const range = preset.resolve?.();
    if (range && range.from === from && range.to === to) return preset.id;
  }
  return "custom";
}

export function RangeCalendarDialog({
  open,
  anchorRef,
  from,
  to,
  presets,
  onApply,
  onClose,
  align = "end",
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  from: string;
  to: string;
  presets: CalendarPreset[];
  onApply: (next: { id: string; from: string; to: string }) => void;
  onClose: () => void;
  align?: "start" | "end";
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const width = Math.min(780, window.innerWidth - 16);
      const height = 470;
      const rect = anchor.getBoundingClientRect();
      const preferred = align === "end" ? rect.right - width : rect.left;
      const left = Math.min(Math.max(8, preferred), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < height && rect.top > spaceBelow ? Math.max(8, rect.top - height - 8) : rect.bottom + 8;
      setBox({ top, left, width });
    }
    place();
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchorRef, onClose, align]);

  if (!open || !box || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Select date range"
      style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 80 }}
      className="max-h-[min(490px,calc(100vh-1rem))] overflow-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_50px_rgba(20,21,26,0.12)]"
    >
      <RangeCalendarBody from={from} to={to} presets={presets} onApply={onApply} onClose={onClose} />
    </div>,
    document.body
  );
}

function RangeCalendarBody({
  from,
  to,
  presets,
  onApply,
  onClose,
}: {
  from: string;
  to: string;
  presets: CalendarPreset[];
  onApply: (next: { id: string; from: string; to: string }) => void;
  onClose: () => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const initialId = matchPreset(from, to, presets);
  const [draft, setDraft] = useState<Draft>({ id: initialId, from, to });
  const [anchor, setAnchor] = useState<string | null>(null);
  const [fromCursor, setFromCursor] = useState(() => parseIso(from) ?? new Date());
  const [toCursor, setToCursor] = useState(() => {
    const start = parseIso(from) ?? new Date();
    const end = parseIso(to) ?? addMonths(start, 1);
    return isSameMonth(start, end) ? addMonths(start, 1) : end;
  });
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const oldest = Math.min(current - 15, parseIso(from)?.getFullYear() ?? current);
    return Array.from({ length: current - oldest + 1 }, (_, index) => oldest + index);
  }, [from]);

  function show(range: { from: string; to: string }) {
    const start = parseIso(range.from) ?? new Date();
    const end = parseIso(range.to) ?? start;
    setFromCursor(start);
    setToCursor(isSameMonth(start, end) ? addMonths(start, 1) : end);
  }

  function selectPreset(preset: CalendarPreset) {
    const range = preset.resolve?.();
    if (!range) {
      setDraft((current) => ({ ...current, id: "custom" }));
      setAnchor(null);
      return;
    }
    setDraft({ id: preset.id, from: range.from, to: range.to });
    setAnchor(null);
    show(range);
  }

  function chooseDay(day: Date) {
    if (isAfter(startOfDay(day), today)) return;
    const value = format(day, "yyyy-MM-dd");
    if (!anchor || (draft.from && draft.to)) {
      setAnchor(value);
      setDraft({ id: "custom", from: value, to: "" });
      return;
    }
    const first = anchor <= value ? anchor : value;
    const second = anchor <= value ? value : anchor;
    setDraft({ id: "custom", from: first, to: second });
    setAnchor(null);
    show({ from: first, to: second });
  }

  function clear() {
    const fallback = presets.find((preset) => preset.id === "30d") ?? presets.find((preset) => preset.resolve);
    if (fallback) selectPreset(fallback);
  }

  return (
    <div className="flex min-h-[430px] flex-col sm:flex-row">
      <div className="w-full shrink-0 border-b border-[var(--color-border-light)] py-2 sm:max-h-[452px] sm:w-[172px] sm:overflow-y-auto sm:border-b-0 sm:border-r sm:py-3">
        {presets.map((preset) => {
          const selected = draft.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset)}
              className={clsx(
                "mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px]",
                selected
                  ? "bg-[var(--color-primary-light)] font-semibold text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {preset.label}
              {selected ? <ChevronRight className="h-3.5 w-3.5 text-primary" /> : null}
            </button>
          );
        })}
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 min-w-[16rem] flex-1 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-primary)]">
            <span>{draft.from ? pretty(draft.from) : "Start"}</span>
            <span className="mx-3 text-[var(--color-text-muted)]">—</span>
            <span>{draft.to ? pretty(draft.to) : "End"}</span>
          </div>
          <button type="button" className="text-sm font-medium text-primary" onClick={clear}>
            Clear
          </button>
          <button type="button" className="text-sm font-medium text-primary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!draft.from || !draft.to}
            onClick={() => onApply(draft)}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground text-on-accent transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply
          </button>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <MonthGrid title="From" cursor={fromCursor} onCursor={setFromCursor} years={years} today={today} from={draft.from} to={draft.to} onPick={chooseDay} />
          <MonthGrid title="To" cursor={toCursor} onCursor={setToCursor} years={years} today={today} from={draft.from} to={draft.to} onPick={chooseDay} />
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  title,
  cursor,
  onCursor,
  years,
  today,
  from,
  to,
  onPick,
}: {
  title: string;
  cursor: Date;
  onCursor: (next: Date) => void;
  years: number[];
  today: Date;
  from: string;
  to: string;
  onPick: (day: Date) => void;
}) {
  const start = parseIso(from);
  const end = parseIso(to);
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  });

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select
          ariaLabel={`${title} month`}
          value={String(cursor.getMonth())}
          onChange={(value) => onCursor(new Date(cursor.getFullYear(), Number(value), 1))}
          options={MONTHS.map((month, index) => ({ value: String(index), label: month }))}
        />
        <Select
          ariaLabel={`${title} year`}
          value={String(cursor.getFullYear())}
          onChange={(value) => onCursor(new Date(Number(value), cursor.getMonth(), 1))}
          options={years.map((year) => ({ value: String(year), label: String(year) }))}
        />
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium text-[var(--color-text-muted)]">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const future = isAfter(startOfDay(day), today);
          const isStart = start ? isSameDay(day, start) : false;
          const isEnd = end ? isSameDay(day, end) : false;
          const inRange =
            Boolean(start && end) &&
            !isBefore(startOfDay(day), startOfDay(start!)) &&
            !isAfter(startOfDay(day), startOfDay(end!));
          return (
            <button
              key={format(day, "yyyy-MM-dd")}
              type="button"
              disabled={future}
              aria-label={format(day, "d MMMM yyyy")}
              aria-pressed={isStart || isEnd}
              onClick={() => onPick(day)}
              className={clsx(
                "flex h-9 items-center justify-center",
                inRange && inMonth && "bg-primary/10",
                isStart && inMonth && "rounded-l-full",
                isEnd && inMonth && "rounded-r-full",
                future && "cursor-not-allowed"
              )}
            >
              <span
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[13px]",
                  !inMonth && "text-[var(--color-text-muted)]/40",
                  inMonth && !isStart && !isEnd && !inRange && "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]",
                  inRange && !isStart && !isEnd && "text-[var(--color-text-primary)]",
                  (isStart || isEnd) && "bg-primary font-semibold text-primary-foreground text-on-accent",
                  future && "opacity-35"
                )}
              >
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-primary"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
