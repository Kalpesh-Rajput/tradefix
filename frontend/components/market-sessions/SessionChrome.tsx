"use client";

import clsx from "clsx";

export function LiveIndicator({
  label = "Live",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]",
        className
      )}
    >
      <span className="ms-live-dot" aria-hidden />
      {label}
    </span>
  );
}

export function SessionStatusBadge({
  open,
  scheduled,
}: {
  open: boolean;
  scheduled?: boolean;
}) {
  if (scheduled) {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Scheduled
      </span>
    );
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        open
          ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-text-primary)]"
          : "bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]"
      )}
    >
      <span
        className={clsx("h-1.5 w-1.5 rounded-full", open ? "ms-live-dot" : "bg-[var(--color-text-muted)]")}
        style={open ? undefined : { animation: "none", boxShadow: "none" }}
        aria-hidden
      />
      {open ? "Open" : "Closed"}
    </span>
  );
}

export function SessionProgress({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-0">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--color-gauge-track)]"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Session progress"}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {label ? (
        <p className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </p>
      ) : null}
    </div>
  );
}
