"use client";

import clsx from "clsx";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /** Accessible name; also used as the tooltip unless `tooltip` is false. */
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "outline" | "sidebar";
  size?: "sm" | "md";
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
  loading?: boolean;
  badge?: ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    variant = "outline",
    size = "md",
    tooltip = true,
    tooltipSide = "bottom",
    loading = false,
    badge,
    className,
    disabled,
    type = "button",
    ...props
  },
  ref
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "group relative inline-flex shrink-0 items-center justify-center rounded-md",
        "transition-[background-color,border-color,color,transform] duration-fast ease-out-expo active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
        "disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        variant === "outline" &&
          "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[color-mix(in_srgb,var(--color-primary)_30%,var(--color-border))] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]",
        variant === "ghost" &&
          "text-[var(--color-text-secondary)] hover:bg-foreground/[0.06] hover:text-[var(--color-text-primary)]",
        variant === "sidebar" && "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground",
        className
      )}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon}
      {badge}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip content={label} side={tooltipSide}>
      {button}
    </Tooltip>
  );
});
