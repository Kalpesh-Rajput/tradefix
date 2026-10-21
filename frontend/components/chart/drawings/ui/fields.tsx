"use client";

import { useEffect, useState } from "react";

export const FIELD_BASE =
  "h-8 rounded-md border border-border bg-surface px-2 text-xs tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

export const FIELD = `${FIELD_BASE} w-full`;

/** Numeric input that commits on blur or Enter and rejects invalid text by reverting. */
export function NumberField({
  label,
  value,
  decimals,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  decimals: number;
  min?: number;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(value.toFixed(decimals));
  useEffect(() => setText(value.toFixed(decimals)), [value, decimals]);
  const commit = () => {
    const parsed = Number(text);
    if (!text.trim() || !Number.isFinite(parsed) || (min != null && parsed < min)) {
      setText(value.toFixed(decimals));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <label className="block text-[11px] text-muted">
      {label}
      <input
        inputMode="decimal"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className={`${FIELD} mt-0.5`}
      />
    </label>
  );
}

export function IconToggle({
  label,
  pressed,
  onClick,
  children,
  danger,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        danger ? "text-muted hover:bg-negative-soft hover:text-negative" : pressed ? "bg-primary/15 text-primary" : "text-muted hover:bg-[var(--color-border-subtle)] hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
