"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { InfoTooltip } from "@/components/ui/InfoTooltip";

export function InsightCard({
  title,
  caption,
  hint,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  caption?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={clsx(
        "chart-card dash-card flex h-full min-h-0 min-w-0 flex-col p-3.5 print:!transform-none print:!opacity-100",
        className,
      )}
      aria-label={title}
    >
      <header className="flex h-8 shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <h3 className="truncate text-[15px] font-bold leading-5 text-[var(--color-text-primary)]">{title}</h3>
          {hint ? <InfoTooltip content={hint} label={title} /> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </header>
      <p className="mb-2 h-4 truncate text-[11px] leading-4 text-[var(--color-text-muted)]">{caption ?? "\u00a0"}</p>
      <div className={clsx("min-h-0 min-w-0 flex-1", bodyClassName)}>{children}</div>
    </motion.section>
  );
}

export function InsufficientState({ reason, height }: { reason: string | null | undefined; height?: number }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-border)] px-4 text-center"
      style={height ? { height } : undefined}
    >
      <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Not enough data yet</p>
      <p className="max-w-[320px] text-[11px] leading-snug text-[var(--color-text-muted)]">
        {reason ?? "Log more trades in this range to unlock this analysis."}
      </p>
    </div>
  );
}

export function Stat({
  label,
  value,
  color,
  hint,
  sub,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  hint?: string;
  sub?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        <span className="truncate">{label}</span>
        {hint ? <InfoTooltip content={hint} label={label} /> : null}
      </p>
      <p className="mt-1 truncate text-[15px] font-semibold tabular-nums tracking-tight" style={{ color: color ?? "var(--color-text-primary)" }}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-muted)]">{sub}</p> : null}
    </div>
  );
}
