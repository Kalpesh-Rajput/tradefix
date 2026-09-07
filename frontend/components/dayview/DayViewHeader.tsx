"use client";

import { Settings, Zap } from "lucide-react";
import Link from "next/link";

import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { ViewSwitcher, type DayViewMode } from "@/components/dayview/ViewSwitcher";
import { useLocale } from "@/components/providers/LocaleProvider";

export function DayViewHeader({
  mode,
  onModeChange,
}: {
  mode: DayViewMode;
  onModeChange: (mode: DayViewMode) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <ViewSwitcher mode={mode} onChange={onModeChange} />
      <div className="flex items-center gap-2">
        <PortfolioSwitcher className="[&_button]:h-8 [&_button]:rounded-md [&_button]:border-[#E4E5EA] [&_button]:bg-white [&_button]:shadow-none [&_button]:text-[12px]" />
        <Link
          href="/diary"
          className="dash-btn-primary text-on-accent h-8 px-3 text-[12px]"
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={2} />
          {t("dayView.startMyDay")}
        </Link>
        <Link
          href="/settings/trading-defaults"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-primary"
          aria-label={t("common.settings")}
          title={t("common.settings")}
        >
          <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}
