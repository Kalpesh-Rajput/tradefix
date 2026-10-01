"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { InsightFilterParams } from "@/lib/hooks/useAiInsights";
import type { AiInsightFacets } from "@/lib/types";

const EMPTY: InsightFilterParams = {};

function sideLabel(side: string) {
  if (side === "long") return "Long";
  if (side === "short") return "Short";
  return side;
}

export function RefineFilters({
  facets,
  value,
  onChange,
}: {
  facets?: AiInsightFacets | null;
  value: InsightFilterParams;
  onChange: (next: InsightFilterParams) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const activeCount = [value.setup, value.symbol, value.session, value.side, value.playbookId].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-1 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors duration-200 hover:text-primary"
      >
        Refine
        {activeCount > 0 ? (
          <span className="rounded-full bg-[var(--color-primary-very-light)] px-1.5 text-[10px] font-semibold text-primary">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute left-0 top-full z-20 mt-1.5 w-[min(calc(100vw-2rem),560px)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FilterSelect
              label="Setup"
              value={value.setup ?? ""}
              options={(facets?.setups ?? []).map((item) => ({ value: item, label: item }))}
              onChange={(setup) => onChange({ ...value, setup: setup || undefined })}
            />
            <FilterSelect
              label="Symbol"
              value={value.symbol ?? ""}
              options={(facets?.symbols ?? []).map((item) => ({ value: item, label: item }))}
              onChange={(symbol) => onChange({ ...value, symbol: symbol || undefined })}
            />
            <FilterSelect
              label="Session"
              value={value.session ?? ""}
              options={(facets?.sessions ?? []).map((item) => ({ value: item, label: item }))}
              onChange={(session) => onChange({ ...value, session: session || undefined })}
            />
            <FilterSelect
              label="Direction"
              value={value.side ?? ""}
              options={(facets?.sides ?? []).map((item) => ({ value: item, label: sideLabel(item) }))}
              onChange={(side) => onChange({ ...value, side: side || undefined })}
            />
            <FilterSelect
              label="Playbook"
              value={value.playbookId ?? ""}
              options={(facets?.playbooks ?? []).map((item) => ({ value: item.id, label: item.name }))}
              onChange={(playbookId) => onChange({ ...value, playbookId: playbookId || undefined })}
            />
          </div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => onChange(EMPTY)}
              className="mt-3 text-[12px] font-medium text-primary"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] font-medium normal-case tracking-normal text-[var(--color-text-primary)] outline-none focus:border-primary/40"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
