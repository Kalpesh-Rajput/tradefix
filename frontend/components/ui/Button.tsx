import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        "active:scale-[0.98]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-3.5 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        variant === "primary" && "bg-primary font-semibold text-primary-foreground hover:opacity-90",
        variant === "secondary" &&
          "border border-white/10 bg-zinc-900 text-white hover:bg-zinc-800",
        variant === "ghost" && "text-zinc-500 hover:bg-white/5 hover:text-white",
        variant === "danger" &&
          "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
        className
      )}
      {...props}
    />
  );
}
