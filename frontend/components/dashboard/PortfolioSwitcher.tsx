"use client";

import clsx from "clsx";
import { Briefcase, Check, ChevronDown, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";

export function PortfolioSwitcher({ className }: { className?: string }) {
  const { accounts, activeAccount, setActiveAccountId, loading } = useAccountPrefs();
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

  const label = loading
    ? "Loading…"
    : activeAccount
      ? activeAccount.is_default
        ? `${activeAccount.name}`
        : activeAccount.name
      : "No portfolio";

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={loading || accounts.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 min-w-[180px] items-center justify-between gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={clsx("h-3.5 w-3.5 shrink-0 text-zinc-400 transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Select portfolio"
          className="absolute right-0 z-50 mt-1.5 w-[240px] overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-xl"
        >
          <ul className="max-h-64 overflow-y-auto py-1">
            {accounts.map((account) => {
              const selected = account.id === activeAccount?.id;
              return (
                <li key={account.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveAccountId(account.id);
                      setOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition",
                      selected ? "bg-primary/10 text-primary" : "text-zinc-300 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{account.name}</span>
                    {account.is_default && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">Default</span>
                    )}
                    {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-white/[0.06] p-1">
            <Link
              href="/settings/accounts"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage accounts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
