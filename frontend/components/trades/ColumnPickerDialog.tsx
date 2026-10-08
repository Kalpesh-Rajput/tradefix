"use client";

import clsx from "clsx";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  DEFAULT_TRADE_COLUMNS,
  TRADE_COLUMNS,
  type TradeColumnId,
  normalizeColumns,
} from "@/lib/trades/logColumns";

const STORAGE_KEY = "tradefix_trades_log_columns";

export function useTradeColumnPrefs() {
  const [columns, setColumns] = useState<TradeColumnId[]>(DEFAULT_TRADE_COLUMNS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setColumns(raw ? normalizeColumns(JSON.parse(raw)) : [...DEFAULT_TRADE_COLUMNS]);
    } catch {
      setColumns([...DEFAULT_TRADE_COLUMNS]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns, ready]);

  return { columns, setColumns };
}

export function ColumnPickerDialog({
  open,
  columns,
  onClose,
  onSave,
}: {
  open: boolean;
  columns: TradeColumnId[];
  onClose: () => void;
  onSave: (columns: TradeColumnId[]) => void;
}) {
  const [draft, setDraft] = useState<TradeColumnId[]>(columns);

  useEffect(() => {
    if (!open) return;
    setDraft(columns);
  }, [open, columns]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function toggle(id: TradeColumnId) {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return normalizeColumns([...next]);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/25 backdrop-blur-[6px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="select-columns-title"
        className="relative z-10 flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 id="select-columns-title" className="text-[18px] font-semibold text-[var(--color-text-primary)]">
              Select columns
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">
              Please select the columns you want to display in the trades list.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-tertiary)] hover:bg-[#F4F4F6] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 pb-3 text-[13px] font-medium text-primary">
          <button type="button" onClick={() => setDraft(TRADE_COLUMNS.map((column) => column.id))} className="hover:underline">
            Select All
          </button>
          <span className="text-[#D4D4D8]" aria-hidden>
            |
          </span>
          <button type="button" onClick={() => setDraft([])} className="hover:underline">
            Clear all
          </button>
          <span className="text-[#D4D4D8]" aria-hidden>
            |
          </span>
          <button type="button" onClick={() => setDraft([...DEFAULT_TRADE_COLUMNS])} className="hover:underline">
            Default
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
            {TRADE_COLUMNS.map((column) => {
              const checked = draft.includes(column.id);
              return (
                <button
                  key={column.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(column.id)}
                  className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-left text-[13px] text-[var(--color-text-primary)] hover:bg-[#F7F7F9]"
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

        <div className="flex justify-end gap-2 border-t border-[#EFEFF2] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-[#E4E4E9] bg-white px-4 text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[#F7F7F9]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={draft.length === 0}
            onClick={() => onSave(normalizeColumns(draft))}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
