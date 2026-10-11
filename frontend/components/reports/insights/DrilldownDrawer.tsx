"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { TradePreviewDrawer } from "@/components/trades/preview/TradePreviewDrawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAnalyticsDrilldown } from "@/lib/hooks/useAdvancedAnalytics";
import { downloadCsv, fmtDateTime, fmtPct, fmtR, fmtRatio, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedFilters } from "@/lib/reports/advanced/query";
import type { DrillRef } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

export function DrilldownDrawer({
  filters,
  drill,
  title,
  periodLabel,
  formatMoney,
  onClose,
}: {
  filters: AdvancedFilters;
  drill: DrillRef;
  title: string;
  periodLabel: string;
  formatMoney: MoneyFormatter;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { data, isLoading, isError, refetch, isFetching } = useAnalyticsDrilldown(filters, drill);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewOpen = previewId != null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prevFocus?.focus?.();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (previewOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, previewOpen]);

  if (!mounted) return null;

  const pnlLabel = filters.pnlMode === "gross" ? "Gross P&L" : "Net P&L";

  function exportRows() {
    if (!data) return;
    downloadCsv(
      `tradefix-${drill.dimension}-${drill.key}.csv`.replace(/[^\w.-]+/g, "_"),
      ["Opened", "Closed", "Symbol", "Side", pnlLabel, "Net P&L", "Fees", "R", "Strategy", "Setups", "Emotions", "Rules broken"],
      data.rows.map((r) => [
        r.opened_at,
        r.closed_at,
        r.symbol,
        r.side,
        r.pnl,
        r.net_pnl,
        r.fees,
        r.r,
        r.strategy,
        r.setups.join("; "),
        r.emotions.join("; "),
        r.rules.join("; "),
      ])
    );
  }

  return createPortal(
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="drill-title">
          <motion.button
            type="button"
            aria-label="Close trades panel"
            className="absolute inset-0 bg-black/35"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            initial={reduce ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-full w-full flex-col overflow-hidden rounded-l-2xl border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)] sm:w-[560px]"
          >
            <header className="shrink-0 border-b border-[var(--color-border)] px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Trades behind this number · {periodLabel}
                  </p>
                  <h2 id="drill-title" className="mt-1 text-[17px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                    {title}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={exportRows}
                    disabled={!data?.rows.length}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--color-border)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] outline-none hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    CSV
                  </button>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] outline-none hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {data ? (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  <Summary label="Trades" value={data.total.toLocaleString()} />
                  <Summary label={pnlLabel} value={formatMoney(data.summary.net_pnl)} color={pnlColor(data.summary.net_pnl)} />
                  <Summary label="Win rate" value={fmtPct(data.summary.win_rate)} />
                  <Summary label="Profit factor" value={fmtRatio(data.summary.profit_factor)} />
                </div>
              ) : null}
              {data?.truncated ? (
                <p className="mt-3 flex items-center gap-1.5 rounded-md bg-[var(--color-surface-secondary)] px-2.5 py-1.5 text-[11px] text-[var(--color-text-secondary)]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Showing the {data.returned} most recent of {data.total.toLocaleString()} trades. Totals above include all{" "}
                  {data.total.toLocaleString()}.
                </p>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-busy={isFetching}>
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 rounded-lg" />
                  ))}
                </div>
              ) : isError ? (
                <div className="m-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[12px] text-[var(--color-text-primary)]">
                  Couldn’t load these trades.{" "}
                  <button type="button" onClick={() => refetch()} className="font-medium text-primary hover:underline">
                    Try again
                  </button>
                </div>
              ) : !data?.rows.length ? (
                <p className="p-6 text-center text-[12px] text-[var(--color-text-muted)]">No trades match this selection.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border-subtle)]">
                  {data.rows.map((row) => {
                    const labels = [...new Set([row.strategy, ...row.setups, ...row.emotions, ...row.rules].filter(Boolean))];
                    return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setPreviewId(row.id)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
                            {row.symbol}
                            <span className="rounded bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--color-text-tertiary)]">
                              {row.side}
                            </span>
                            {row.possible_duplicate ? (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                                Possible duplicate
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                            {fmtDateTime(row.opened_at)}
                            {labels.length ? ` · ${labels.join(", ")}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-semibold tabular-nums" style={{ color: pnlColor(row.pnl) }}>
                            {formatMoney(row.pnl)}
                          </p>
                          <p className="text-[10px] tabular-nums text-[var(--color-text-muted)]">{fmtR(row.r)}</p>
                        </div>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
      {previewId ? (
        <TradePreviewDrawer
          tradeId={previewId}
          trades={[]}
          formatMoney={formatMoney}
          onClose={() => setPreviewId(null)}
          onSelectTrade={setPreviewId}
        />
      ) : null}
    </>,
    document.body
  );
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums" style={{ color: color ?? "var(--color-text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
