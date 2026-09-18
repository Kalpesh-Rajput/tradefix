"use client";

import clsx from "clsx";

export function ReportSegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={clsx(
              "inline-flex h-8 items-center rounded-md px-3 text-[12px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
              active
                ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
