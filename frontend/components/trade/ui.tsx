"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  layoutId = "segment-pill",
  tone = "primary",
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  layoutId?: string;
  tone?: "primary" | "neutral";
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex h-12 w-full items-center gap-1 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              "group relative flex h-full min-w-[4.5rem] flex-1 items-center justify-center rounded-[10px] px-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              size === "sm" ? "text-[12px]" : "text-[13px]",
              active
                ? "font-semibold text-primary-foreground text-on-accent"
                : "font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className={clsx(
                  "absolute inset-0 rounded-[10px]",
                  tone === "primary" ? "bg-primary group-hover:bg-primary-hover" : "bg-[var(--color-text-primary)]"
                )}
                transition={{ duration: 0.16, ease: "easeOut" }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{opt.label}</span>
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
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
      <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
        {title}
        {subtitle ? <span className="sr-only"> {subtitle}</span> : null}
      </label>
      {children}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-[var(--color-border)] pt-5">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-primary)]">{title}</h3>
      {children}
    </section>
  );
}

export const tradeInputClass =
  "h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-normal placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] focus:border-primary focus:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-40";

export const tradeTextareaClass =
  "min-h-[120px] w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm font-medium leading-6 text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-normal placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] focus:border-primary focus:shadow-[var(--focus-ring)]";

export const tradeNumberClass = `${tradeInputClass} font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

export function formInputClass(error?: string) {
  return clsx(tradeInputClass, error && "border-destructive/70 focus:border-destructive/70");
}

export function formNumberClass(error?: string) {
  return clsx(tradeNumberClass, error && "border-destructive/70 focus:border-destructive/70");
}

export function FieldSlot({ name, children, className }: { name: string; children: ReactNode; className?: string }) {
  return (
    <div data-field={name} className={className}>
      {children}
    </div>
  );
}

export function NumField({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel error={error}>{label}</FieldLabel>
      <input
        type="number"
        step="any"
        inputMode="decimal"
        aria-invalid={error ? true : undefined}
        className={formNumberClass(error)}
        {...props}
      />
    </div>
  );
}

export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-12 items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3">
        <span className="truncate font-mono text-sm font-medium text-[var(--color-text-primary)]">{value}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          <Calculator className="h-3 w-3" aria-hidden />
          Calculated
        </span>
      </div>
    </div>
  );
}

export function FieldLabel({
  children,
  error,
  htmlFor,
}: {
  children: ReactNode;
  error?: string;
  htmlFor?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
        {children}
      </label>
      {error ? <span className="truncate text-[10px] text-destructive">{error}</span> : null}
    </div>
  );
}

export const tradeGridClass = "grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
