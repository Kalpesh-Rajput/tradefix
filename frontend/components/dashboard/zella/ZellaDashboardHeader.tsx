"use client";

import clsx from "clsx";
import { LayoutGrid, Upload } from "lucide-react";
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
}: {
  dateFrom: string;
  dateTo: string;
  onRangeChange: (from: string, to: string) => void;
  greeting: string;
  editing: boolean;
  onToggleEdit: () => void;
  onImport: () => void;
}) {
  const toolbar = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-[12px] font-semibold text-primary-foreground text-on-accent"
          title="Display currency"
          aria-label="Display currency"
        >
          $
        </span>
        <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onRangeChange} />
        <PortfolioSwitcher className="[&_button]:h-8 [&_button]:rounded-md [&_button]:border-[var(--color-border)] [&_button]:bg-[var(--color-surface)] [&_button]:shadow-none [&_button]:text-[11px]" />
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
    [dateFrom, dateTo, onRangeChange, editing, onToggleEdit, onImport]
  );

  return <HeaderActions subtitle={greeting}>{toolbar}</HeaderActions>;
}
