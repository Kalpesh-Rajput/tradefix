"use client";

import clsx from "clsx";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { RangeCalendarDialog, type CalendarPreset } from "@/components/ui/RangeCalendarDialog";

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

function inclusive(days: number) {
  const today = startOfDay(new Date());
  const from = new Date(today);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  return { from: localIso(from), to: localIso(today) };
}

export type PresetId = "7d" | "30d" | "90d" | "this_month" | "last_month" | "ytd" | "all";

export function rangeForPreset(id: PresetId): { from: string; to: string } {
  const today = startOfDay(new Date());
  const to = localIso(today);

  if (id === "7d") return inclusive(7);
  if (id === "30d") return inclusive(30);
  if (id === "90d") return inclusive(90);
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
  return { from: "2015-01-01", to };
}

const DASHBOARD_PRESETS: CalendarPreset[] = [
  { id: "custom", label: "Customised", resolve: null },
  { id: "today", label: "Today", resolve: () => inclusive(1) },
  { id: "3d", label: "Last 3 Days", resolve: () => inclusive(3) },
  { id: "7d", label: "Last 7 Days", resolve: () => rangeForPreset("7d") },
  { id: "30d", label: "Last 30 Days", resolve: () => rangeForPreset("30d") },
  { id: "90d", label: "Last 3 Months", resolve: () => rangeForPreset("90d") },
  { id: "180d", label: "Last 6 Months", resolve: () => inclusive(180) },
  { id: "365d", label: "Last 1 Year", resolve: () => inclusive(365) },
  { id: "this_month", label: "This month", resolve: () => rangeForPreset("this_month") },
  { id: "last_month", label: "Last month", resolve: () => rangeForPreset("last_month") },
  { id: "ytd", label: "Year to date", resolve: () => rangeForPreset("ytd") },
  { id: "all", label: "All time", resolve: () => rangeForPreset("all") },
];

export function DateRangePicker({
  dateFrom,
  dateTo,
  onChange,
  className,
  triggerClassName,
  buttonLabel,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
  className?: string;
  triggerClassName?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const label = buttonLabel || formatRangeLabel(dateFrom, dateTo);

  return (
    <div className={clsx("relative", className)}>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          "inline-flex items-center gap-1.5 border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]",
          triggerClassName ?? "h-8 min-w-[210px] max-w-[280px] rounded-md"
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 truncate text-left" title={formatRangeLabel(dateFrom, dateTo)}>
          {label}
        </span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform duration-150",
            open && "rotate-180"
          )}
          strokeWidth={1.75}
        />
      </button>
      <RangeCalendarDialog
        open={open}
        anchorRef={anchorRef}
        align="end"
        from={dateFrom}
        to={dateTo}
        presets={DASHBOARD_PRESETS}
        onClose={close}
        onApply={(next) => {
          onChange(next.from, next.to);
          setOpen(false);
        }}
      />
    </div>
  );
}
