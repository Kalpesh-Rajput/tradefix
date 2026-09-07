"use client";

import clsx from "clsx";

import { useLocale } from "@/components/providers/LocaleProvider";

export type DayViewMode = "day" | "week";

export function ViewSwitcher({
  mode,
  onChange,
}: {
  mode: DayViewMode;
  onChange: (mode: DayViewMode) => void;
}) {
  const { t } = useLocale();

  return (
    <div
      className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
      role="tablist"
      aria-label={t("dayView.title")}
    >
      {(["day", "week"] as const).map((id) => {
        const selected = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={clsx(
              "h-7 rounded-[5px] px-3 text-[12px] font-medium transition-colors",
              selected
                ? "bg-[var(--color-primary-light)] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {id === "day" ? t("dayView.day") : t("dayView.week")}
          </button>
        );
      })}
    </div>
  );
}
