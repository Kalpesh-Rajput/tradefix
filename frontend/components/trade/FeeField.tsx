"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";

import { FieldLabel } from "@/components/trade/ui";
import { fmtMoney } from "@/lib/format";

type FeeMode = "amount" | "percent";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function trimNum(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toFixed(digits)));
}

export function FeeField({
  label,
  amount,
  basis,
  basisLabel,
  onChange,
  error,
}: {
  label: string;
  amount: number | string | null | undefined;
  basis: number;
  basisLabel: string;
  onChange: (amount: number) => void;
  error?: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const [mode, setMode] = useState<FeeMode>("amount");
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const percentRef = useRef<number | null>(null);
  const amountRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const stored = Number(amount);
  const safeAmount = Number.isFinite(stored) ? stored : 0;
  const safeBasis = Number.isFinite(basis) && basis > 0 ? basis : 0;
  const percent = safeBasis > 0 ? (safeAmount / safeBasis) * 100 : null;
  amountRef.current = safeAmount;
  onChangeRef.current = onChange;

  useEffect(() => {
    if (focused) return;
    if (mode === "amount") {
      setText(safeAmount ? trimNum(safeAmount) : "");
      return;
    }
    const shown = percentRef.current ?? percent;
    setText(shown ? trimNum(shown, 4) : "");
  }, [focused, mode, percent, safeAmount]);

  useEffect(() => {
    if (mode !== "percent" || percentRef.current == null || safeBasis <= 0) return;
    const next = round2((safeBasis * percentRef.current) / 100);
    if (Math.abs(next - amountRef.current) < 0.001) return;
    onChangeRef.current(next);
  }, [mode, safeBasis]);

  function write(raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    setText(cleaned);
    if (cleaned === "" || cleaned === ".") {
      if (mode === "amount") onChange(0);
      else percentRef.current = 0;
      return;
    }
    const next = Number(cleaned);
    if (!Number.isFinite(next) || next < 0) return;
    if (mode === "amount") {
      onChange(round2(next));
      return;
    }
    percentRef.current = next;
    if (safeBasis > 0) onChange(round2((safeBasis * next) / 100));
  }

  function selectMode(next: FeeMode) {
    if (next === mode) return;
    if (next === "percent") {
      percentRef.current = percent;
      setText(percent ? trimNum(percent, 4) : "");
    } else {
      percentRef.current = null;
      setText(safeAmount ? trimNum(safeAmount) : "");
    }
    setMode(next);
  }

  const counterpart =
    mode === "amount"
      ? percent == null
        ? "—"
        : `${trimNum(percent, 4)}%`
      : fmtMoney(safeAmount, { signed: false });
  const hint =
    safeBasis > 0
      ? mode === "amount"
        ? `${counterpart} of ${fmtMoney(safeBasis, { signed: false })} ${basisLabel}`
        : `${fmtMoney(safeAmount, { signed: false })} from ${trimNum(percentRef.current ?? percent ?? 0, 4)}% of ${basisLabel}`
      : `Enter price and size to calculate a percent of ${basisLabel}`;

  return (
    <div>
      <FieldLabel error={error} htmlFor={inputId}>
        {label}
      </FieldLabel>
      <div
        className={clsx(
          "flex h-12 w-full items-center gap-1.5 rounded-xl border bg-[var(--color-surface)] px-2 transition-[border-color,box-shadow] duration-150",
          error
            ? "border-destructive/70 focus-within:border-destructive/70"
            : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)] focus-within:border-primary focus-within:shadow-[var(--focus-ring)]"
        )}
      >
        <input
          id={inputId}
          inputMode="decimal"
          aria-invalid={error ? true : undefined}
          aria-describedby={hintId}
          value={text}
          placeholder={mode === "amount" ? "0.00" : "0.00"}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => write(event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm font-medium text-[var(--color-text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--color-text-muted)]"
        />
        <span
          id={hintId}
          title={hint}
          className="max-w-[38%] shrink-0 truncate text-right font-mono text-[11px] font-medium text-[var(--color-text-muted)]"
        >
          {counterpart}
        </span>
        <div role="group" aria-label={`${label} unit`} className="flex h-7 shrink-0 items-center rounded-lg bg-[var(--color-surface-secondary)] p-0.5">
          {(
            [
              ["amount", "$"],
              ["percent", "%"],
            ] as const
          ).map(([key, unit]) => {
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                aria-label={key === "amount" ? "Fee amount" : "Fee percent"}
                onClick={() => selectMode(key)}
                className={clsx(
                  "h-6 min-w-6 rounded-md px-1.5 text-[11px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  active
                    ? "bg-primary text-primary-foreground text-on-accent"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {unit}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
