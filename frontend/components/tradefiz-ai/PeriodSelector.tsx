"use client";

import clsx from "clsx";

import { PERIODS } from "@/lib/ai-insights/presentation";
import type { InsightWindow } from "@/lib/hooks/useAiInsights";

export function PeriodSelector({
  value,
  onChange,
}: {
  value: InsightWindow;
  onChange: (window: InsightWindow) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="inline-flex flex-nowrap rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
        role="group"
        aria-label="Insight period"
      >
        {PERIODS.map((period) => {
          const selected = period.id === value;
          return (
            <button
              key={period.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(period.id)}
              className={clsx(
                "h-8 min-w-9 shrink-0 rounded-md px-2.5 text-[12px] font-semibold transition-colors duration-200",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {period.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
