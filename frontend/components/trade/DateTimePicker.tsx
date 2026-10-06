"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FieldLabel, formInputClass } from "@/components/trade/ui";

type ClockPart = "h" | "m" | "s";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parseClock(value: string): { h: number; m: number; s: number } {
  const [rawH = "0", rawM = "0", rawS = "0"] = (value || "").split(":");
  return {
    h: clamp(Number(rawH), 0, 23),
    m: clamp(Number(rawM), 0, 59),
    s: clamp(Number(rawS), 0, 59),
  };
}

export function formatClock(h: number, m: number, s: number) {
  return `${pad(clamp(h, 0, 23))}:${pad(clamp(m, 0, 59))}:${pad(clamp(s, 0, 59))}`;
}

export function currentClock(date = new Date()) {
  return formatClock(date.getHours(), date.getMinutes(), date.getSeconds());
}

export function parseDateValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function toDateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function placePopover(anchor: HTMLElement, width: number, height: number) {
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < height + margin && rect.top > spaceBelow;
  const top = openUp ? Math.max(margin, rect.top - height - 6) : Math.min(rect.bottom + 6, window.innerHeight - height - margin);
  return { top, left, width };
}

export function DateField({
  label,
  value,
  onChange,
  error,
  disabled,
  id,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
}) {
  const reactId = useId();
  const fieldId = id || reactId;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseDateValue(value) ?? new Date());
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = parseDateValue(value);

  useEffect(() => {
    if (open) setCursor(parseDateValue(value) ?? new Date());
  }, [open, value]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    function place() {
      if (!rootRef.current) return;
      setBox(placePopover(rootRef.current, 292, 332));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  });

  const menu =
    open && box && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label={label}
            style={{ position: "fixed", top: box.top, left: box.left, width: 292, zIndex: 80 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                aria-label="Previous month"
                onClick={() => setCursor((current) => addMonths(current, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{format(cursor, "MMM yyyy")}</p>
              <button
                type="button"
                className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                aria-label="Next month"
                onClick={() => setCursor((current) => addMonths(current, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const inMonth = isSameMonth(day, cursor);
                const isSelected = selected ? isSameDay(day, selected) : false;
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    aria-pressed={isSelected}
                    aria-current={today ? "date" : undefined}
                    onClick={() => {
                      onChange(toDateValue(day));
                      setOpen(false);
                    }}
                    className={`h-8 rounded-md text-xs transition-colors ${
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground text-on-accent"
                        : today
                          ? "text-primary ring-1 ring-primary/40"
                          : inMonth
                            ? "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
                            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-secondary)]"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex justify-end border-t border-[var(--color-border-subtle)] pt-2">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-[var(--color-primary-very-light)]"
                onClick={() => {
                  const today = new Date();
                  onChange(toDateValue(today));
                  setCursor(today);
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef}>
      <FieldLabel error={error} htmlFor={fieldId}>
        {label}
      </FieldLabel>
      <button
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`${formInputClass(error)} flex items-center justify-between text-left font-medium`}
      >
        <span className={selected ? "font-medium text-[var(--color-text-primary)]" : "font-normal text-[var(--color-text-muted)]"}>
          {selected ? format(selected, "d MMM yyyy") : "Select date"}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
      </button>
      {menu}
    </div>
  );
}

export function TimeField({
  label,
  value,
  onChange,
  error,
  disabled,
  id,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
  id?: string;
}) {
  const reactId = useId();
  const fieldId = id || reactId;
  const parsed = parseClock(value);
  const [draft, setDraft] = useState<{ h: string; m: string; s: string } | null>(null);
  const focused = useRef<ClockPart>("m");
  const shown = draft ?? { h: pad(parsed.h), m: pad(parsed.m), s: pad(parsed.s) };

  useEffect(() => {
    setDraft(null);
  }, [value]);

  function commit(next: { h: number; m: number; s: number }) {
    const formatted = formatClock(next.h, next.m, next.s);
    setDraft(null);
    if (formatted !== value) onChange(formatted);
  }

  function step(part: ClockPart, delta: number) {
    const current = parseClock(value || formatClock(parsed.h, parsed.m, parsed.s));
    if (part === "h") current.h = (current.h + delta + 24) % 24;
    if (part === "m") current.m = (current.m + delta + 60) % 60;
    if (part === "s") current.s = (current.s + delta + 60) % 60;
    commit(current);
  }

  function onPartChange(part: ClockPart, raw: string) {
    if (raw.includes(":")) {
      const next = parseClock(raw);
      commit(next);
      return;
    }
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    const nextDraft = { ...(draft ?? shown), [part]: digits };
    setDraft(nextDraft);
    if (digits.length === 2) {
      const next = parseClock(`${nextDraft.h || "0"}:${nextDraft.m || "0"}:${nextDraft.s || "0"}`);
      commit(next);
    }
  }

  function onBlur(part: ClockPart) {
    const source = draft ?? shown;
    const next = parseClock(`${source.h || "0"}:${source.m || "0"}:${source.s || "0"}`);
    if (part === "h" && source.h === "") next.h = parsed.h;
    if (part === "m" && source.m === "") next.m = parsed.m;
    if (part === "s" && source.s === "") next.s = parsed.s;
    commit(next);
  }

  const parts: { key: ClockPart; label: string; max: number }[] = [
    { key: "h", label: "Hours", max: 23 },
    { key: "m", label: "Minutes", max: 59 },
    { key: "s", label: "Seconds", max: 59 },
  ];

  return (
    <div>
      <FieldLabel error={error} htmlFor={fieldId}>
        {label}
      </FieldLabel>
      <div
        className={`${formInputClass(error)} flex items-center gap-2 px-3 focus-within:border-primary focus-within:shadow-[var(--focus-ring)]`}
        aria-invalid={error ? true : undefined}
      >
        <Clock className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
        {parts.map((part, index) => (
          <div key={part.key} className="flex items-center">
            {index > 0 ? <span className="px-0.5 text-[var(--color-text-muted)]">:</span> : null}
            <input
              id={index === 0 ? fieldId : undefined}
              aria-label={part.label}
              inputMode="numeric"
              disabled={disabled}
              value={shown[part.key]}
              onFocus={(event) => {
                focused.current = part.key;
                event.currentTarget.select();
              }}
              onChange={(event) => onPartChange(part.key, event.target.value)}
              onBlur={() => onBlur(part.key)}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  step(part.key, 1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  step(part.key, -1);
                }
              }}
              className="w-8 bg-transparent text-center font-mono text-sm font-medium text-[var(--color-text-primary)] outline-none focus:text-primary"
            />
          </div>
        ))}
        <div className="ml-auto flex items-center gap-0.5">
          <div className="flex flex-col">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Increase time"
              className="rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => step(focused.current, 1)}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Decrease time"
              className="rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => step(focused.current, -1)}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            disabled={disabled}
            className="rounded-md px-1.5 py-1 text-[12px] font-semibold text-primary transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]"
            onClick={() => commit(parseClock(currentClock()))}
          >
            Now
          </button>
        </div>
      </div>
    </div>
  );
}
