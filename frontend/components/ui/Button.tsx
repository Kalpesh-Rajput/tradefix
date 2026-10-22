import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";

import { Spinner } from "@/components/ui/Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  /** Disables the button and shows a spinner while keeping its width. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-lg font-medium",
        "transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-fast ease-out-expo motion-reduce:transition-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "active:scale-[0.98] disabled:active:scale-100 motion-reduce:active:scale-100",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        variant === "primary" &&
          "bg-primary font-semibold text-primary-foreground text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-primary-hover",
        variant === "secondary" &&
          "tf-btn-secondary border border-border bg-surface-2 text-foreground hover:border-primary/30 hover:bg-surface",
        variant === "ghost" && "tf-btn-ghost text-muted hover:bg-foreground/5 hover:text-foreground",
        variant === "danger" &&
          "tf-btn-danger border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner className="h-3.5 w-3.5" />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
