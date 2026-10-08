"use client";

import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Control, useController } from "react-hook-form";
import { useReducedMotion } from "framer-motion";

import { AddTradeFormValues, FUTURE_MOMENT_MESSAGE } from "@/components/trade/schema";
import { useToast } from "@/components/ui/Toast";
import {
  currentClock,
  formatClock,
  parseClock,
  parseDateValue,
  toDateValue,
} from "@/components/trade/DateTimePicker";
import { FieldLabel, FieldSlot, formInputClass, tableInputClass } from "@/components/trade/ui";

const ITEM = 36;
const POPOVER_WIDTH = 528;
const STACKED_WIDTH = 340;

type Clock = { h: number; m: number; s: number };

function placePopover(anchor: HTMLElement, width: number, height: number) {
  const rect = anchor.getBoundingClientRect();
  const margin = 8;
  const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceBelow < height + margin && rect.top > spaceBelow;
  const top = openUp
    ? Math.max(margin, rect.top - height - 6)
    : Math.min(rect.bottom + 6, Math.max(margin, window.innerHeight - height - margin));
  return { top, left };
}

function TimeColumn({
  label,
  count,
  value,
  onChange,
  isAllowed,
  onBlocked,
}: {
  label: string;
  count: number;
  value: number;
  onChange: (next: number) => void;
  isAllowed?: (next: number) => boolean;
  onBlocked?: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const origin = useRef<"scroll" | "prop">("prop");
  const settle = useRef(0);
  const values = Array.from({ length: count }, (_, index) => index);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (origin.current === "scroll") {
      origin.current = "prop";
      return;
    }
    const target = value * ITEM;
    if (Math.abs(el.scrollTop - target) < 1) return;
    syncing.current = true;
    const previous = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollTop = target;
    el.style.scrollBehavior = previous;
    window.requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, [value]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  function snapToValue() {
    const el = scroller.current;
    if (!el) return;
    syncing.current = true;
    const previous = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollTop = value * ITEM;
    el.style.scrollBehavior = previous;
    window.requestAnimationFrame(() => {
      syncing.current = false;
    });
  }

  function choose(next: number) {
    if (isAllowed && !isAllowed(next)) {
      snapToValue();
      onBlocked?.();
      return;
    }
    onChange(next);
  }

  function readScroll() {
    const el = scroller.current;
    if (!el || syncing.current) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (!scroller.current || syncing.current) return;
      const next = Math.min(count - 1, Math.max(0, Math.round(scroller.current.scrollTop / ITEM)));
      if (next === value) return;
      if (isAllowed && !isAllowed(next)) {
        snapToValue();
        onBlocked?.();
        return;
      }
      origin.current = "scroll";
      onChange(next);
    }, 70);
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="relative h-[180px]">
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 z-0 h-9 -translate-y-1/2 rounded-lg bg-[var(--color-primary-very-light)] ring-1 ring-primary/30"
          aria-hidden
        />
        <div
          ref={scroller}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={readScroll}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              choose((value - 1 + count) % count);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              choose((value + 1) % count);
            }
          }}
          className="absolute inset-0 z-[1] overflow-y-auto overscroll-contain scroll-smooth snap-y snap-mandatory motion-reduce:scroll-auto [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-scrollbar]:hidden"
        >
          <div style={{ height: ITEM * 2 }} />
          {values.map((item) => {
            const selected = item === value;
            const blocked = Boolean(isAllowed && !isAllowed(item));
            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={blocked || undefined}
                tabIndex={-1}
                onClick={() => choose(item)}
                className={`flex h-9 w-full snap-center items-center justify-center font-mono text-sm transition-colors duration-150 ${
                  blocked
                    ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-35"
                    : selected
                      ? "font-semibold text-primary"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {String(item).padStart(2, "0")}
              </button>
            );
          })}
          <div style={{ height: ITEM * 2 }} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--color-surface)] to-transparent" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[var(--color-surface)] to-transparent" aria-hidden />
      </div>
    </div>
  );
}

export function DateTimeMomentField({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
  error,
  slotName,
  timeSlotName,
  compact = false,
  placeholder = "e.g. 2026/10/06 10:03:19",
  blockFuture = true,
}: {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  label: string;
  error?: string;
  slotName?: string;
  timeSlotName?: string;
  compact?: boolean;
  placeholder?: string;
  blockFuture?: boolean;
}) {
  const reduced = useReducedMotion();
  const toast = useToast();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [draftDate, setDraftDate] = useState(() => parseDateValue(date) ?? new Date());
  const [cursor, setCursor] = useState(() => parseDateValue(date) ?? new Date());
  const [clock, setClock] = useState<Clock>(() => parseClock(time || currentClock()));
  const [limit, setLimit] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  const warnedAt = useRef(0);
  const anchorRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parseDateValue(date || "");
  const shownClock = parseClock(time || "");
  const hasTime = Boolean(time);
  const summary = selected
    ? compact
      ? `${format(selected, "yyyy/MM/dd")}${hasTime ? ` ${formatClock(shownClock.h, shownClock.m, shownClock.s)}` : ""}`
      : `${format(selected, "d MMM yyyy")}${hasTime ? ` · ${formatClock(shownClock.h, shownClock.m, shownClock.s)}` : ""}`
    : compact
      ? placeholder
      : "Select date & time";

  function warnFuture() {
    setNotice(FUTURE_MOMENT_MESSAGE);
    const now = Date.now();
    if (now - warnedAt.current < 1600) return;
    warnedAt.current = now;
    toast.error(FUTURE_MOMENT_MESSAGE);
  }

  function momentAfterLimit(day: Date, next: Clock, ceiling = limit) {
    if (!blockFuture) return false;
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), next.h, next.m, next.s, 0);
    return candidate.getTime() > ceiling.getTime();
  }

  function dayAfterLimit(day: Date, ceiling = limit) {
    if (!blockFuture) return false;
    return startOfDay(day).getTime() > startOfDay(ceiling).getTime();
  }

  function begin(anchor: HTMLElement) {
    anchorRef.current = anchor;
    setNotice("");
    const ceiling = new Date();
    setLimit(ceiling);
    if (!open) {
      const nextDate = parseDateValue(date) ?? ceiling;
      setDraftDate(nextDate);
      setCursor(nextDate);
      setClock(parseClock(time || currentClock(ceiling)));
    }
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    function place() {
      if (!anchorRef.current) return;
      const beside = window.innerWidth >= 560;
      const width = Math.min(beside ? POPOVER_WIDTH : STACKED_WIDTH, window.innerWidth - 16);
      const height = Math.min(beside ? 460 : 640, window.innerHeight - 16);
      setBox({ ...placePopover(anchorRef.current, width, height), width });
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
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !blockFuture) return;
    const id = window.setInterval(() => setLimit(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [open, blockFuture]);

  function apply() {
    const ceiling = new Date();
    setLimit(ceiling);
    if (momentAfterLimit(draftDate, clock, ceiling)) {
      warnFuture();
      return;
    }
    const nextDate = toDateValue(draftDate);
    const nextTime = formatClock(clock.h, clock.m, clock.s);
    if (nextDate !== date) onDateChange(nextDate);
    if (nextTime !== time) onTimeChange(nextTime);
    setNotice("");
    setOpen(false);
  }

  function setNow() {
    const now = new Date();
    setLimit(now);
    setNotice("");
    setDraftDate(now);
    setCursor(now);
    setClock({ h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() });
  }

  function partAllowed(part: "h" | "m" | "s", value: number) {
    if (!blockFuture) return true;
    if (part === "h") {
      return new Date(draftDate.getFullYear(), draftDate.getMonth(), draftDate.getDate(), value, 0, 0, 0).getTime() <= limit.getTime();
    }
    if (part === "m") {
      return new Date(draftDate.getFullYear(), draftDate.getMonth(), draftDate.getDate(), clock.h, value, 0, 0).getTime() <= limit.getTime();
    }
    return !momentAfterLimit(draftDate, { ...clock, s: value });
  }

  function changeClock(part: "h" | "m" | "s", value: number) {
    setNotice("");
    const ceiling = new Date();
    setLimit(ceiling);
    setClock((current) => {
      const next = { ...current, [part]: value };
      if (!momentAfterLimit(draftDate, next, ceiling)) return next;
      if (part === "h") return { h: value, m: ceiling.getMinutes(), s: ceiling.getSeconds() };
      if (part === "m") return { h: current.h, m: value, s: ceiling.getSeconds() };
      return current;
    });
  }

  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  });

  function moveDay(day: Date, delta: number) {
    const next = addDays(day, delta);
    setCursor(next);
    window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>(`[data-date="${toDateValue(next)}"]`)?.focus();
    });
  }

  const menu =
    open && box
      ? createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Date and time"
            style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 80 }}
            className={`max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)] ${
              reduced ? "" : "animate-[entryMomentIn_150ms_ease-out]"
            }`}
          >
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">Date & time</p>
            {notice ? (
              <p role="alert" className="mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-[12px] font-medium text-destructive">
                {notice}
              </p>
            ) : null}
            <div className="mt-3 flex flex-col gap-3 min-[560px]:flex-row min-[560px]:items-stretch">
            <div className="min-w-0 min-[560px]:w-[292px] min-[560px]:shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{format(cursor, "MMMM yyyy")}</p>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="Previous month"
                  onClick={() => setCursor((current) => addMonths(current, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label="Next month"
                  onClick={() => setCursor((current) => addMonths(current, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label="Calendar">
              {days.map((day) => {
                const inMonth = isSameMonth(day, cursor);
                const isSelected = isSameDay(day, draftDate);
                const today = isToday(day);
                const future = dayAfterLimit(day);
                return (
                  <button
                    key={toDateValue(day)}
                    type="button"
                    role="gridcell"
                    data-date={toDateValue(day)}
                    aria-pressed={isSelected}
                    aria-disabled={future || undefined}
                    aria-current={today ? "date" : undefined}
                    onClick={() => {
                      if (future) {
                        warnFuture();
                        return;
                      }
                      setNotice("");
                      setDraftDate(day);
                      if (!inMonth) setCursor(day);
                      if (momentAfterLimit(day, clock)) {
                        const ceiling = new Date();
                        setLimit(ceiling);
                        setClock({ h: ceiling.getHours(), m: ceiling.getMinutes(), s: ceiling.getSeconds() });
                      }
                    }}
                    onKeyDown={(event) => {
                      const delta =
                        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -7 : event.key === "ArrowDown" ? 7 : 0;
                      if (!delta) return;
                      event.preventDefault();
                      moveDay(day, delta);
                    }}
                    className={`h-8 rounded-md text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      future
                        ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-35"
                        : isSelected
                          ? "bg-primary font-semibold text-primary-foreground text-on-accent"
                          : today
                            ? "font-medium text-primary ring-1 ring-primary/40 hover:bg-[var(--color-primary-very-light)]"
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
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-[var(--color-primary-very-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onClick={() => {
                  const today = new Date();
                  setLimit(today);
                  setNotice("");
                  setDraftDate(today);
                  setCursor(today);
                  if (momentAfterLimit(today, clock, today)) {
                    setClock({ h: today.getHours(), m: today.getMinutes(), s: today.getSeconds() });
                  }
                }}
              >
                Today
              </button>
            </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col border-t border-[var(--color-border)] pt-3 min-[560px]:justify-center min-[560px]:border-l min-[560px]:border-t-0 min-[560px]:pl-3 min-[560px]:pt-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Time</p>
              <div className="mt-2 flex gap-1.5">
                <TimeColumn
                  label="Hour"
                  count={24}
                  value={clock.h}
                  isAllowed={(h) => partAllowed("h", h)}
                  onBlocked={warnFuture}
                  onChange={(h) => changeClock("h", h)}
                />
                <TimeColumn
                  label="Minute"
                  count={60}
                  value={clock.m}
                  isAllowed={(m) => partAllowed("m", m)}
                  onBlocked={warnFuture}
                  onChange={(m) => changeClock("m", m)}
                />
                <TimeColumn
                  label="Second"
                  count={60}
                  value={clock.s}
                  isAllowed={(s) => partAllowed("s", s)}
                  onBlocked={warnFuture}
                  onChange={(s) => changeClock("s", s)}
                />
              </div>
            </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
              <button
                type="button"
                className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-primary hover:bg-[var(--color-primary-very-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                onClick={setNow}
              >
                Now
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  onClick={apply}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const control = (
    <>
      <div data-field={timeSlotName}>
          {compact ? null : (
            <FieldLabel error={error} htmlFor={fieldId}>
              {label}
            </FieldLabel>
          )}
          <button
            ref={triggerRef}
            id={fieldId}
            type="button"
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={error ? true : undefined}
            onClick={() => begin(triggerRef.current!)}
            className={`${compact ? tableInputClass(error) : formInputClass(error)} flex items-center justify-between gap-2 text-left`}
          >
            <span
              className={`min-w-0 truncate ${
                selected ? "font-medium text-[var(--color-text-primary)]" : "font-normal text-[var(--color-text-muted)]"
              }`}
            >
              {summary}
            </span>
            <Calendar className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
          </button>
        </div>
      {menu}
    </>
  );

  if (!slotName) return control;
  return <FieldSlot name={slotName}>{control}</FieldSlot>;
}

export function EntryMomentFields({
  control,
  dateError,
  timeError,
}: {
  control: Control<AddTradeFormValues>;
  dateError?: string;
  timeError?: string;
}) {
  const { field: dateField } = useController({ control, name: "entryDate" });
  const { field: timeField } = useController({ control, name: "entryTime" });
  return (
    <DateTimeMomentField
      date={dateField.value || ""}
      time={timeField.value || ""}
      onDateChange={dateField.onChange}
      onTimeChange={timeField.onChange}
      label="Entry date & time"
      error={dateError || timeError}
      slotName="entryDate"
      timeSlotName="entryTime"
    />
  );
}
