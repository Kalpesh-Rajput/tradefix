"use client";

import { Copy, MoreVertical } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useToast } from "@/components/ui/Toast";
import { formatMetricValue } from "@/lib/reports/format";
import type { MoneyFormatter } from "@/lib/reports/types";
import type { OverviewModel, OverviewMonthHighlight, OverviewStatRow } from "@/lib/reports/overview";

export function OverviewStatsCard({
  model,
  rangeLabel,
  formatMoney,
}: {
  model: OverviewModel;
  rangeLabel: string;
  formatMoney: MoneyFormatter;
}) {
  return (
    <section className="dash-card p-4 sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-primary)]">
            Your stats
          </h2>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            ({rangeLabel})
          </p>
        </div>
        <OverviewStatsMenu model={model} />
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8">
        <SummaryMetric
          label="Best month"
          highlight={model.bestMonth}
          formatMoney={formatMoney}
        />
        <SummaryMetric
          label="Lowest month"
          highlight={model.lowestMonth}
          formatMoney={formatMoney}
        />
        <div>
          <p className="text-[12px] text-[var(--color-text-secondary)]">Average</p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
            {model.avgMonth == null ? "—" : formatMetricValue(model.avgMonth, "currency", formatMoney)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">per Month</p>
        </div>
      </div>

      {model.empty ? (
        <p className="mt-6 text-[13px] text-[var(--color-text-muted)]">
          No trading data available for the selected period.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-x-10 md:grid-cols-2">
          <StatColumn rows={model.left} />
          <StatColumn rows={model.right} />
        </div>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  highlight,
  formatMoney,
}: {
  label: string;
  highlight: OverviewMonthHighlight | null;
  formatMoney: MoneyFormatter;
}) {
  return (
    <div>
      <p className="text-[12px] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
        {highlight ? formatMetricValue(highlight.value, "currency", formatMoney) : "—"}
      </p>
      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{highlight?.caption ?? "—"}</p>
    </div>
  );
}

function StatColumn({ rows }: { rows: OverviewStatRow[] }) {
  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 border-b border-[var(--color-border-subtle)] py-2 last:border-0"
        >
          <span className="min-w-0 text-[12px] leading-4 text-[var(--color-text-secondary)]">{row.label}</span>
          <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--color-text-primary)]">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function OverviewStatsMenu({ model }: { model: OverviewModel }) {
  const toast = useToast();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  async function copyStats() {
    const lines = [
      "Your stats",
      ...model.left.map((r) => `${r.label}\t${r.value}`),
      ...model.right.map((r) => `${r.label}\t${r.value}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Stats copied");
    } catch {
      toast.error("Couldn’t copy stats");
    }
    close();
  }

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            className="fixed z-[220] min-w-[148px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              role="menuitem"
              className="flex h-8 w-full items-center gap-2 px-3 text-[12px] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-secondary)]"
              onClick={copyStats}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy stats
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Stats actions"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPos({
            top: rect.bottom + 6,
            left: Math.max(8, Math.min(rect.right - 148, window.innerWidth - 156)),
          });
          setOpen(true);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] outline-none hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {panel}
    </>
  );
}
