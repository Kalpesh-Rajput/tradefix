"use client";

import clsx from "clsx";
import { Filter, LayoutGrid, Upload } from "lucide-react";
import { useMemo } from "react";

import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { HeaderActions } from "@/components/layout/HeaderActions";

const headerIconBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]";

export function ZellaDashboardHeader({
  dateFrom,
  dateTo,
  onRangeChange,
  greeting,
  editing,
  onToggleEdit,
  onImport,
  filterCount,
  filtersOpen,
  onOpenFilters,
}: {
  dateFrom: string;
  dateTo: string;
  onRangeChange: (from: string, to: string) => void;
  greeting: string;
  editing: boolean;
  onToggleEdit: () => void;
  onImport: () => void;
  filterCount: number;
  filtersOpen: boolean;
  onOpenFilters: () => void;
}) {
  const toolbar = useMemo(
    () => (
      <div className="contents lg:flex lg:w-auto lg:flex-wrap lg:items-center lg:justify-end lg:gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className={clsx(
            "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            filterCount > 0 || filtersOpen
              ? "border-primary/40 bg-[var(--color-primary-light)] text-primary"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
          )}
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          aria-label={filterCount > 0 ? `Advance Filter, ${filterCount} active` : "Advance Filter"}
        >
          <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
          Advance Filter
          {filterCount > 0 ? (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
              {filterCount}
            </span>
          ) : null}
        </button>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={onRangeChange}
          className="order-2 w-full min-w-0 lg:order-none lg:w-auto"
          triggerClassName="h-8 w-full min-w-0 rounded-md lg:w-auto lg:min-w-[12.5rem] lg:max-w-[18rem]"
        />
        <PortfolioSwitcher className="order-3 w-full min-w-0 lg:order-none lg:w-[11.5rem] [&_button]:h-8 [&_button]:w-full [&_button]:min-w-0 [&_button]:max-w-full [&_button]:rounded-md [&_button]:border-[var(--color-border)] [&_button]:bg-[var(--color-surface)] [&_button]:px-2.5 [&_button]:shadow-none [&_button]:text-[11px]" />
        <button
          type="button"
          onClick={onToggleEdit}
          className={clsx(
            headerIconBtn,
            editing && "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
          )}
          aria-pressed={editing}
          aria-label="Edit Widgets"
          title="Edit Widgets"
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onImport}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-on-accent transition-colors duration-150 hover:bg-primary-hover"
          aria-label="Import Trades"
          title="Import Trades"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    ),
    [dateFrom, dateTo, onRangeChange, editing, onToggleEdit, onImport, filterCount, filtersOpen, onOpenFilters]
  );

  return <HeaderActions subtitle={greeting}>{toolbar}</HeaderActions>;
}
