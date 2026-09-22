"use client";

import { useState } from "react";

import type { AiInsightWhy } from "@/lib/types";

export function InsightWhy({ why }: { why: AiInsightWhy }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-[var(--color-text-tertiary)] underline-offset-2 hover:text-[var(--color-text-secondary)] hover:underline"
      >
        Why am I seeing this?
      </button>
      {open ? (
        <p className="mt-1.5 rounded-md bg-[var(--color-primary-very-light)] px-2.5 py-2 text-[11px] leading-4 text-[var(--color-text-secondary)]">
          {why.narrative}
        </p>
      ) : null}
    </div>
  );
}
