"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import type { MyDayPhase } from "@/lib/my-day";

const STEPS: { id: MyDayPhase; n: number; label: string }[] = [
  { id: "planning", n: 1, label: "Planning" },
  { id: "trading", n: 2, label: "Trading" },
  { id: "review", n: 3, label: "Trade Review" },
];

export function MyDayToolbar({
  heading,
  phase,
  canGoForward,
  datePicker,
  onPrev,
  onNext,
  onPhase,
  onStartTrading,
}: {
  heading: string;
  phase: MyDayPhase;
  canGoForward: boolean;
  datePicker?: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onPhase: (phase: MyDayPhase) => void;
  onStartTrading: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <h2 className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">{heading}</h2>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoForward}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {datePicker}
      </div>

      <nav aria-label="Day workflow" className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
        {STEPS.map((step, i) => {
          const active = phase === step.id;
          const done = STEPS.findIndex((s) => s.id === phase) > i;
          return (
            <div key={step.id} className="flex items-center gap-1 sm:gap-2">
              {i > 0 ? <span className="hidden h-px w-6 bg-[var(--color-border)] sm:block" aria-hidden /> : null}
              <button
                type="button"
                onClick={() => onPhase(step.id)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium",
                  active
                    ? "bg-[var(--color-primary-very-light)] text-primary"
                    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={clsx(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    active || done ? "bg-primary text-on-accent" : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                  )}
                >
                  {step.n}
                </span>
                {step.label}
              </button>
            </div>
          );
        })}
      </nav>

      <button type="button" onClick={onStartTrading} className="dash-btn-primary text-on-accent shrink-0">
        Start Trading
      </button>
    </div>
  );
}
