"use client";

import clsx from "clsx";

/** Accessible on/off control. The visual state always mirrors `checked`. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  size = "md",
  className,
  id,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** Accessible name when no visible `<label htmlFor>` points at this switch. */
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-base ease-out-expo motion-reduce:transition-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-4 w-7" : "h-5 w-9",
        checked
          ? "border-transparent bg-primary"
          : "border-[var(--color-border-strong,var(--color-border))] bg-[var(--color-surface-muted,hsl(var(--surface-2)))]",
        className
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none inline-block rounded-full shadow-sm transition-transform duration-base ease-out-expo motion-reduce:transition-none",
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
          checked
            ? clsx("bg-primary-foreground", size === "sm" ? "translate-x-[13px]" : "translate-x-[18px]")
            : "translate-x-[2px] bg-[var(--color-text-muted)]"
        )}
      />
    </button>
  );
}
