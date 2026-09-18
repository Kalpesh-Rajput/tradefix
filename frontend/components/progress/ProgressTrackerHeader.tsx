"use client";

import clsx from "clsx";
import { Briefcase, Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { useAccountPrefs } from "@/components/providers/AccountProvider";

export function ProgressTrackerHeader({
  dateFrom,
  dateTo,
  onRangeChange,
  accountId,
  onAccountChange,
}: {
  dateFrom: string;
  dateTo: string;
  onRangeChange: (from: string, to: string) => void;
  accountId: string | null;
  onAccountChange: (id: string | null) => void;
}) {
  const { accounts, loading, currencySymbol } = useAccountPrefs();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = accountId ? accounts.find((a) => a.id === accountId)?.name ?? "Account" : "All accounts";

  return (
    <HeaderActions>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium">
          {currencySymbol.trim() || "$"}
        </span>
        <DateRangePicker
          dateFrom={dateFrom}
          dateTo={dateTo}
          onChange={onRangeChange}
          buttonLabel="Date range"
          triggerClassName="h-8 min-w-0 rounded-md"
        />
        <div ref={rootRef} className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label="Select accounts"
            disabled={loading}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-8 min-w-[148px] max-w-[200px] items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown className={clsx("h-3.5 w-3.5 text-muted", open && "rotate-180")} />
          </button>
          {open ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute right-0 z-30 mt-1 min-w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            >
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!accountId}
                  className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--color-primary-very-light)]"
                  onClick={() => {
                    onAccountChange(null);
                    setOpen(false);
                  }}
                >
                  All accounts
                  {!accountId ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </button>
              </li>
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={accountId === account.id}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-[var(--color-primary-very-light)]"
                    onClick={() => {
                      onAccountChange(account.id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{account.name}</span>
                    {accountId === account.id ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </HeaderActions>
  );
}
