"use client";

import { Bell } from "lucide-react";

import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function ZellaDashboardHeader({
  dateFrom,
  dateTo,
  onRangeChange,
}: {
  dateFrom: string;
  dateTo: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  const { t } = useLocale();

  return (
    <header className="z-20 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 sm:px-5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[17px] font-semibold leading-6 tracking-tight text-[var(--color-text-primary)]">
          {t("dashboard.title")}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-[12px] font-semibold text-primary-foreground text-on-accent"
            title="Display currency"
            aria-label="Display currency"
          >
            $
          </span>

          <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={onRangeChange} />

          <PortfolioSwitcher className="[&_button]:h-8 [&_button]:rounded-md [&_button]:border-[var(--color-border)] [&_button]:bg-[var(--color-surface)] [&_button]:shadow-none [&_button]:text-[11px]" />

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
            aria-label="Notifications"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
