"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  layoutId = "segment-pill",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  layoutId?: string;
}) {
  return (
    <div className="inline-flex w-full items-center gap-0.5 rounded-lg bg-surface-2 p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              "relative flex-1 rounded-md text-xs font-semibold capitalize transition-all",
              size === "sm" ? "px-3 py-1.5" : "py-1.5",
              active ? "text-background shadow-sm" : "text-muted hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-md bg-foreground shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChipGroup({
  options,
  value,
  onChange,
  tone = "accent",
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  tone?: "accent" | "danger";
}) {
  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((item) => {
        const on = value.includes(item);
        return (
          <button
            key={item}
            type="button"
            onClick={() => toggle(item)}
            className={clsx(
              "rounded-lg border px-3 py-1.5 text-xs transition-colors",
              on
                ? tone === "danger"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted">
        {title}
        {subtitle ? <span className="sr-only"> {subtitle}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function FieldLabel({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <label className="text-[10px] uppercase tracking-wider text-muted">{children}</label>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}
