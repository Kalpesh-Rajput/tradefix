"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  DEFAULT_TRADE_COLUMNS,
  TRADE_COLUMNS,
  normalizeColumns,
  type TradeColumnId,
} from "@/lib/trades/logColumns";
import type { LocalFilters } from "@/lib/trades/logFilters";
import {
  downloadTradeExport,
  exportFailureMessage,
  fetchExportCount,
  type ExportFormat,
  type ExportScope,
  type PnlDisplayMode,
} from "@/lib/trades/exportTrades";

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: "csv", label: "CSV" },
  { id: "xlsx", label: "Excel (.xlsx)" },
  { id: "xml", label: "XML" },
];

const SCOPES: { id: ExportScope; label: string }[] = [
  { id: "filtered", label: "Current filtered trades" },
  { id: "all", label: "All trades" },
  { id: "custom", label: "Custom selection" },
];

export function ExportTradesDialog({
  open,
  filters,
  accountId,
  pnlDisplayMode,
  onClose,
  onBusyChange,
}: {
  open: boolean;
  filters: LocalFilters;
  accountId?: string;
  pnlDisplayMode: PnlDisplayMode;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [scope, setScope] = useState<ExportScope>("filtered");
  const [columns, setColumns] = useState<TradeColumnId[]>(DEFAULT_TRADE_COLUMNS);
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState("");
  const [phase, setPhase] = useState<"idle" | "preparing" | "generating">("idle");
  const [formError, setFormError] = useState("");

  const busy = phase !== "idle";
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    setPhase("idle");
    if (open) {
      setFormat("csv");
      setScope("filtered");
      setColumns([...DEFAULT_TRADE_COLUMNS]);
      setFormError("");
      setCount(null);
      setCountError("");
    }
  }

  useEffect(() => {
    onBusyChange?.(open && busy);
  }, [open, busy, onBusyChange]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCount(null);
    setCountError("");
    fetchExportCount(filters, accountId, pnlDisplayMode, scope)
      .then((next) => {
        if (!cancelled) setCount(next);
      })
      .catch((error) => {
        if (!cancelled) setCountError(exportFailureMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [open, filters, accountId, pnlDisplayMode, scope]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  const empty = count === 0;
  const missingColumns = scope === "custom" && columns.length === 0;
  const canExport = count != null && count > 0 && !countError && !busy && !missingColumns;

  function toggleColumn(id: TradeColumnId) {
    setColumns((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return normalizeColumns([...next]);
    });
  }

  async function onExport() {
    if (!canExport) return;
    setFormError("");
    setPhase("preparing");
    try {
      await downloadTradeExport(filters, accountId, pnlDisplayMode, scope, format, () => setPhase("generating"), columns);
      const exported = count ?? 0;
      toast.success(
        exported === 1 ? "1 trade exported successfully." : `${exported} trades exported successfully.`
      );
      onClose();
    } catch (error) {
      const message = exportFailureMessage(error);
      setFormError(message);
      toast.error(message);
      setPhase("idle");
    }
  }

  const selection =
    countError ||
    (count == null
      ? "Counting trades…"
      : empty
        ? "No trades available to export."
        : `Current selection: ${count} ${count === 1 ? "trade" : "trades"}`);
  const statusText = formError || (missingColumns ? "Select at least one column." : selection);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/25 backdrop-blur-[6px]"
        aria-label="Close"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          "relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
          scope === "custom" ? "max-w-[760px]" : "max-w-[440px]"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 id={titleId} className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Export Trades
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-[var(--color-text-tertiary)] hover:bg-[#F4F4F6] hover:text-[var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 pb-5"
          onSubmit={(event) => {
            event.preventDefault();
            void onExport();
          }}
        >
          <fieldset disabled={busy} className="min-w-0 space-y-2 disabled:opacity-60">
            <legend className="mb-2 text-[13px] font-semibold text-[var(--color-text-primary)]">Export format</legend>
            {FORMATS.map((option) => (
              <label
                key={option.id}
                className={clsx(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
                  format === option.id
                    ? "border-primary/40 bg-[var(--color-primary-light)] text-[var(--color-text-primary)]"
                    : "border-[#E4E4E9] text-[var(--color-text-secondary)] hover:bg-[#F8F8FA]"
                )}
              >
                <input
                  type="radio"
                  name="export-format"
                  value={option.id}
                  checked={format === option.id}
                  onChange={() => setFormat(option.id)}
                  className="accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset disabled={busy} className="min-w-0 space-y-2 disabled:opacity-60">
            <legend className="mb-2 text-[13px] font-semibold text-[var(--color-text-primary)]">Export data</legend>
            {SCOPES.map((option) => (
              <label
                key={option.id}
                className={clsx(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition-colors",
                  scope === option.id
                    ? "border-primary/40 bg-[var(--color-primary-light)] text-[var(--color-text-primary)]"
                    : "border-[#E4E4E9] text-[var(--color-text-secondary)] hover:bg-[#F8F8FA]"
                )}
              >
                <input
                  type="radio"
                  name="export-scope"
                  value={option.id}
                  checked={scope === option.id}
                  onChange={() => setScope(option.id)}
                  className="accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                {option.label}
              </label>
            ))}
            {scope === "custom" ? (
              <div className="pt-2">
                <p className="text-[13px] text-[var(--color-text-tertiary)]">
                  Choose the columns to include. This exports the current filtered trades.
                </p>
                <div className="mt-2 flex items-center gap-2 text-[13px] font-medium text-primary">
                  <button
                    type="button"
                    onClick={() => setColumns(TRADE_COLUMNS.map((column) => column.id))}
                    className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Select All
                  </button>
                  <span className="text-[#D4D4D8]" aria-hidden>
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => setColumns([])}
                    className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Clear all
                  </button>
                  <span className="text-[#D4D4D8]" aria-hidden>
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => setColumns([...DEFAULT_TRADE_COLUMNS])}
                    className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Default
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                  {TRADE_COLUMNS.map((column) => {
                    const checked = columns.includes(column.id);
                    return (
                      <button
                        key={column.id}
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggleColumn(column.id)}
                        className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[#F7F7F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <span
                          className={clsx(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                            checked ? "border-primary bg-primary text-white" : "border-[#D0D0D6] bg-white"
                          )}
                        >
                          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 truncate" title={column.label}>
                          {column.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </fieldset>

          <p
            className={clsx(
              "text-[13px]",
              countError || formError || missingColumns ? "text-destructive" : "text-[var(--color-text-secondary)]"
            )}
            aria-live="polite"
          >
            {statusText}
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canExport} aria-busy={busy}>
              {phase === "preparing" ? "Preparing export..." : phase === "generating" ? "Generating file..." : "Export Trades"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
