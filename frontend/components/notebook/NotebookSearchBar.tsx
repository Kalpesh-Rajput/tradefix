"use client";

import clsx from "clsx";
import { Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DayViewCalendar } from "@/components/dayview/DayViewCalendar";
import { formatNumericDate } from "@/components/notebook/dateFormat";
import type { NotebookSort } from "@/components/notebook/types";
import { localIso, parseLocalIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";

export function NotebookSearchBar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  showFavorites,
  dateFrom,
  dateTo,
  onDateRangeChange,
  accountId,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: NotebookSort;
  onSortChange: (sort: NotebookSort) => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  showFavorites: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  onDateRangeChange: (from: string | null, to: string | null) => void;
  accountId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => dateFrom ?? localIso(new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const bounds = useMemo(() => {
    const cursor = parseLocalIso(month);
    return {
      start: localIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      end: localIso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
    };
  }, [month]);
  const { data: calendar } = useCalendar(bounds.start, bounds.end, accountId, {
    enabled: open && !!accountId,
  });

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rangeLabel =
    dateFrom && dateTo
      ? dateFrom === dateTo
        ? formatNumericDate(dateFrom)
        : `${formatNumericDate(dateFrom)} – ${formatNumericDate(dateTo)}`
      : null;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search notes"
          className="h-9 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-background)] pl-9 pr-3 text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
        />
      </label>
      {rangeLabel ? (
        <button
          type="button"
          onClick={() => onDateRangeChange(null, null)}
          className="inline-flex h-8 max-w-[180px] items-center gap-1 rounded-full border border-primary/20 bg-[var(--color-primary-light)] px-2.5 text-[11px] font-medium text-primary"
        >
          <span className="truncate">{rangeLabel}</span>
          <X className="h-3 w-3 shrink-0" />
        </button>
      ) : null}
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]",
            (open || favoritesOnly || sort === "oldest" || dateFrom) && "border-primary/40 text-primary"
          )}
          aria-label="Filter notes"
          aria-expanded={open}
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        {open ? (
          <div className="absolute right-0 z-40 mt-1 w-[300px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)]">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Date range
            </p>
            <DayViewCalendar
              variant="picker"
              selectMode="range"
              days={calendar?.days ?? []}
              month={month}
              rangeFrom={dateFrom}
              rangeTo={dateTo}
              onMonthChange={(start) => setMonth(start)}
              onRangeChange={(from, to) => onDateRangeChange(from, to)}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onDateRangeChange(null, null);
                  setOpen(false);
                }}
                className="h-7 rounded-md px-2 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
              >
                Clear dates
              </button>
            </div>
            <div className="my-2 h-px bg-[var(--color-border)]" />
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Sort
            </p>
            <button
              type="button"
              onClick={() => onSortChange("newest")}
              className={clsx(
                "block w-full rounded-md px-2 py-1.5 text-left text-[12px]",
                sort === "newest"
                  ? "bg-[var(--color-primary-light)] text-primary"
                  : "hover:bg-[var(--color-primary-very-light)]"
              )}
            >
              Newest first
            </button>
            <button
              type="button"
              onClick={() => onSortChange("oldest")}
              className={clsx(
                "block w-full rounded-md px-2 py-1.5 text-left text-[12px]",
                sort === "oldest"
                  ? "bg-[var(--color-primary-light)] text-primary"
                  : "hover:bg-[var(--color-primary-very-light)]"
              )}
            >
              Oldest first
            </button>
            {showFavorites ? (
              <button
                type="button"
                onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
                className={clsx(
                  "mt-1 block w-full rounded-md px-2 py-1.5 text-left text-[12px]",
                  favoritesOnly
                    ? "bg-[var(--color-primary-light)] text-primary"
                    : "hover:bg-[var(--color-primary-very-light)]"
                )}
              >
                {favoritesOnly ? "Show all" : "Favorites only"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
