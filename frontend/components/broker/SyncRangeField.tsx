"use client";

import clsx from "clsx";
import { addDays, format, startOfDay } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useCallback, useId, useMemo, useRef, useState } from "react";

import { RangeCalendarDialog, type CalendarPreset } from "@/components/ui/RangeCalendarDialog";

const SERVER_PRESETS = new Set(["7d", "30d", "90d", "180d", "365d"]);

const RANGES: { id: string; label: string; days?: number }[] = [
  { id: "custom", label: "Customised" },
  { id: "today", label: "Today", days: 0 },
  { id: "3d", label: "Last 3 Days", days: 3 },
  { id: "7d", label: "Last 7 Days", days: 7 },
  { id: "30d", label: "Last 30 Days", days: 30 },
  { id: "90d", label: "Last 3 Months", days: 90 },
  { id: "180d", label: "Last 6 Months", days: 180 },
  { id: "365d", label: "Last 1 Year", days: 365 },
];

function iso(date: Date) {
  return format(startOfDay(date), "yyyy-MM-dd");
}

function rangeFor(id: string): { from: string; to: string } | null {
  const item = RANGES.find((range) => range.id === id);
  if (!item || item.days === undefined) return null;
  const end = startOfDay(new Date());
  return { from: iso(addDays(end, -item.days)), to: iso(end) };
}

function labelFor(id: string) {
  return RANGES.find((range) => range.id === id)?.label ?? "Select dates";
}

function pretty(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return format(new Date(year, month - 1, day), "d MMMM yyyy");
}

export function SyncRangeField({
  preset,
  from,
  to,
  onChange,
}: {
  preset: string;
  from: string;
  to: string;
  options?: string[];
  onChange: (next: { preset: string; from: string; to: string }) => void;
}) {
  const reactId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const presets = useMemo<CalendarPreset[]>(
    () =>
      RANGES.map((range) => ({
        id: range.id,
        label: range.label,
        resolve:
          range.days === undefined
            ? null
            : () => rangeFor(range.id) ?? { from: "", to: "" },
      })),
    []
  );
  const visible = preset !== "custom" && rangeFor(preset) ? rangeFor(preset)! : { from, to };
  const buttonLabel =
    preset === "custom" && from && to ? `${pretty(from)} – ${pretty(to)}` : labelFor(preset === "custom" ? "custom" : preset);

  return (
    <div>
      <span id={reactId} className="mb-1.5 block text-sm font-medium text-foreground">
        Date Range to Sync
      </span>
      <button
        ref={rootRef}
        type="button"
        aria-labelledby={reactId}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm text-foreground"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{buttonLabel}</span>
        <ChevronDown className={clsx("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      <RangeCalendarDialog
        open={open}
        anchorRef={rootRef}
        align="start"
        from={visible.from}
        to={visible.to}
        presets={presets}
        onClose={close}
        onApply={(next) => {
          if (SERVER_PRESETS.has(next.id)) onChange({ preset: next.id, from: "", to: "" });
          else onChange({ preset: "custom", from: next.from, to: next.to });
          setOpen(false);
        }}
      />
    </div>
  );
}
