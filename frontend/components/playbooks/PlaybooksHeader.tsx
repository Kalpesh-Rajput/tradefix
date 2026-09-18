"use client";

import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { useAccountPrefs } from "@/components/providers/AccountProvider";

export function PlaybooksHeader({
  dateFrom,
  dateTo,
  onRangeChange,
}: {
  dateFrom: string;
  dateTo: string;
  onRangeChange: (from: string, to: string) => void;
}) {
  const { currencySymbol } = useAccountPrefs();

  return (
    <HeaderActions>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)]"
          title="Display currency"
        >
          {currencySymbol.trim() || "$"}
        </span>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={onRangeChange}
          buttonLabel="Date range"
          triggerClassName="h-8 min-w-0 rounded-md"
        />
        <PortfolioSwitcher className="[&_button]:h-8 [&_button]:min-w-0 [&_button]:max-w-[168px] [&_button]:rounded-md [&_button]:border-[var(--color-border)] [&_button]:bg-[var(--color-surface)] [&_button]:px-2.5 [&_button]:text-[11px] [&_button]:shadow-none" />
      </div>
    </HeaderActions>
  );
}
