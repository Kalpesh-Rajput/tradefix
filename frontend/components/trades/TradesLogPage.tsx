"use client";

import clsx from "clsx";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useQuickLog } from "@/components/providers/QuickLogProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { ASSET_OPTIONS } from "@/components/trade/schema";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useDeleteTrade, useDeleteTrades, useTrades } from "@/lib/hooks/useTrades";
import type { AssetType, Trade, TradeSide } from "@/lib/types";

type StatusTab = "all" | "open" | "closed";

type LocalFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
  status: StatusTab;
  asset_type: AssetType | "";
  side: TradeSide | "";
  setup_tag: string;
};

const FILTERS_STORAGE_KEY = "tradefix_trades_log_filters";

function assetLabel(type: AssetType): string {
  return ASSET_OPTIONS.find((a) => a.value === type)?.label.toLowerCase() ?? type;
}

function qtyLabel(trade: Trade): string {
  const q = Number(trade.quantity);
  const formatted = Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
  if (trade.asset_type === "option") return `${formatted} contracts`;
  if (trade.asset_type === "forex") return `${formatted} lots`;
  if (trade.asset_type === "future") return `${formatted} contracts`;
  return formatted;
}

function tradeDateKey(trade: Trade): string {
  const raw = trade.closed_at || trade.opened_at;
  return raw.slice(0, 10);
}

function moneyPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function readStored(): Partial<LocalFilters> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<LocalFilters>;
  } catch {
    return {};
  }
}

export function TradesLogPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { openModal } = useAddTradeModal();
  const { openQuickLog } = useQuickLog();
  const { activeAccount, displayPnl, formatMoney, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;

  const [filters, setFilters] = useState<LocalFilters>({
    search: "",
    dateFrom: "",
    dateTo: "",
    status: "all",
    asset_type: "",
    side: "",
    setup_tag: "",
  });
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);

  const deleteTrade = useDeleteTrade();
  const deleteTrades = useDeleteTrades();

  useEffect(() => {
    if (user?.save_filters) {
      const stored = readStored();
      setFilters((prev) => ({
        ...prev,
        search: stored.search ?? "",
        dateFrom: stored.dateFrom ?? "",
        dateTo: stored.dateTo ?? "",
        status: stored.status ?? "all",
        asset_type: stored.asset_type ?? "",
        side: stored.side ?? "",
        setup_tag: stored.setup_tag ?? "",
      }));
    }
    setHydrated(true);
  }, [user?.save_filters]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.save_filters) {
      window.localStorage.removeItem(FILTERS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters, user?.save_filters, hydrated]);

  useEffect(() => {
    if (!filtersOpen) return;
    function onDown(e: MouseEvent) {
      if (!filtersRef.current?.contains(e.target as Node)) setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [filtersOpen]);

  useEffect(() => {
    setSelected(new Set());
  }, [filters.status, filters.search, filters.dateFrom, filters.dateTo, filters.asset_type, filters.side, filters.setup_tag, accountId]);

  const apiFilters = useMemo(
    () => ({
      account_id: accountId,
      date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
      date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      setup_tag: filters.setup_tag || undefined,
      limit: 1000,
    }),
    [accountId, filters.dateFrom, filters.dateTo, filters.setup_tag]
  );

  const { data: trades = [], isLoading, isError, refetch } = useTrades(apiFilters, {
    enabled: !!accountId,
  });

  const lastClosedTradeId = useMemo(() => {
    const closed = trades.filter((t) => t.status === "closed");
    if (!closed.length) return null;
    return [...closed].sort(
      (a, b) =>
        new Date(b.closed_at || b.opened_at).getTime() -
        new Date(a.closed_at || a.opened_at).getTime()
    )[0]?.id;
  }, [trades]);

  const search = filters.search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.asset_type && t.asset_type !== filters.asset_type) return false;
      if (filters.side && t.side !== filters.side) return false;
      if (search) {
        const hay = `${t.symbol} ${t.setup_tag ?? ""} ${t.notes ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [trades, filters.status, filters.asset_type, filters.side, search]);

  const counts = useMemo(() => {
    const base = trades.filter((t) => {
      if (filters.asset_type && t.asset_type !== filters.asset_type) return false;
      if (filters.side && t.side !== filters.side) return false;
      if (search) {
        const hay = `${t.symbol} ${t.setup_tag ?? ""} ${t.notes ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    return {
      all: base.length,
      open: base.filter((t) => t.status === "open").length,
      closed: base.filter((t) => t.status === "closed").length,
    };
  }, [trades, filters.asset_type, filters.side, search]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((t) => t.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteOne(trade: Trade) {
    if (!confirm(`Delete ${trade.symbol} trade?`)) return;
    try {
      await deleteTrade.mutateAsync(trade.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(trade.id);
        return next;
      });
      toast.success("Trade deleted");
    } catch (err) {
      toast.error("Could not delete trade", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected trade${ids.length === 1 ? "" : "s"}?`)) return;
    try {
      await deleteTrades.mutateAsync(ids);
      setSelected(new Set());
      toast.success(`${ids.length} trade${ids.length === 1 ? "" : "s"} deleted`);
    } catch (err) {
      toast.error("Could not delete trades", err instanceof Error ? err.message : undefined);
    }
  }

  const activeExtraFilters = Boolean(filters.asset_type || filters.side || filters.setup_tag);
  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/[0.06] px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Trades</h1>
          <div className="flex items-center gap-2">
            <PortfolioSwitcher />
            <button
              type="button"
              onClick={() => openQuickLog(lastClosedTradeId)}
              disabled={!lastClosedTradeId}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              title={lastClosedTradeId ? "Quick log last closed trade" : "No closed trades yet"}
            >
              Quick Log
            </button>
            <button
              type="button"
              onClick={() => openModal("manual")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Trade
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search symbol or strategy…"
              className="h-9 w-full rounded-lg border border-white/10 bg-zinc-900/80 pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-primary/40"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <DateField
              value={filters.dateFrom}
              onChange={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
              ariaLabel="From date"
            />
            <span className="text-zinc-600">–</span>
            <DateField
              value={filters.dateTo}
              onChange={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
              ariaLabel="To date"
            />
          </div>

          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={clsx(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition",
                activeExtraFilters || filtersOpen
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeExtraFilters && (
                <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
                  {[filters.asset_type, filters.side, filters.setup_tag].filter(Boolean).length}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-white/10 bg-zinc-950 p-3 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">Filter trades</span>
                  <button
                    type="button"
                    className="text-[11px] text-zinc-500 hover:text-white"
                    onClick={() =>
                      setFilters((f) => ({ ...f, asset_type: "", side: "", setup_tag: "" }))
                    }
                  >
                    Clear
                  </button>
                </div>
                <label className="mb-2 block text-[10px] uppercase tracking-wider text-zinc-600">Class</label>
                <select
                  value={filters.asset_type}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, asset_type: e.target.value as AssetType | "" }))
                  }
                  className="mb-3 h-9 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-white outline-none"
                >
                  <option value="">All classes</option>
                  {ASSET_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <label className="mb-2 block text-[10px] uppercase tracking-wider text-zinc-600">Side</label>
                <select
                  value={filters.side}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, side: e.target.value as TradeSide | "" }))
                  }
                  className="mb-3 h-9 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-white outline-none"
                >
                  <option value="">All sides</option>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
                <label className="mb-2 block text-[10px] uppercase tracking-wider text-zinc-600">Strategy</label>
                <input
                  value={filters.setup_tag}
                  onChange={(e) => setFilters((f) => ({ ...f, setup_tag: e.target.value }))}
                  placeholder="e.g. Breakout"
                  className="h-9 w-full rounded-lg border border-white/10 bg-zinc-900 px-2 text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center rounded-lg border border-white/10 p-0.5">
            {(
              [
                { key: "all", label: "All", count: counts.all },
                { key: "open", label: "Open", count: counts.open },
                { key: "closed", label: "Closed", count: counts.closed },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, status: tab.key }))}
                className={clsx(
                  "h-8 rounded-md px-3 text-xs font-medium transition",
                  filters.status === tab.key
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {tab.label}{" "}
                <span className="tabular-nums text-zinc-500">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {someSelected && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2">
            <span className="text-xs text-zinc-400">{selected.size} selected</span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleteTrades.isPending}
              className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto text-zinc-500 hover:text-white"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-zinc-300">
            Couldn’t load trades.{" "}
            <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-16 text-center">
            <p className="text-sm text-zinc-400">
              {trades.length === 0
                ? "No trades yet — add your first trade or import a CSV."
                : "No trades match these filters."}
            </p>
            {trades.length === 0 && (
              <button
                type="button"
                onClick={() => openModal("manual")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Add Trade
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="w-10 py-3 pr-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-2 py-3 font-medium">Date</th>
                  <th className="px-2 py-3 font-medium">Ticker</th>
                  <th className="px-2 py-3 font-medium">Class</th>
                  <th className="px-2 py-3 font-medium">Side</th>
                  <th className="px-2 py-3 font-medium">Qty</th>
                  <th className="px-2 py-3 font-medium">Entry</th>
                  <th className="px-2 py-3 font-medium">Exit</th>
                  <th className="px-2 py-3 font-medium">Strategy</th>
                  <th className="px-2 py-3 font-medium">P&amp;L</th>
                  <th className="px-2 py-3 font-medium">Notes</th>
                  <th className="w-20 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((trade) => {
                  const pnl = displayPnl(trade.pnl, trade.fees);
                  const checked = selected.has(trade.id);
                  return (
                    <tr
                      key={trade.id}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                    >
                      <td className="py-3.5 pr-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(trade.id)}
                          className="h-3.5 w-3.5 rounded border-white/20 bg-transparent"
                          aria-label={`Select ${trade.symbol}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-3.5 font-mono text-xs text-zinc-400">
                        {tradeDateKey(trade)}
                      </td>
                      <td className="px-2 py-3.5">
                        <Link
                          href={`/trades/${trade.id}`}
                          className="inline-flex rounded-md bg-zinc-800/80 px-2 py-0.5 font-mono text-xs font-medium text-white hover:bg-zinc-700"
                        >
                          {trade.symbol}
                        </Link>
                      </td>
                      <td className="px-2 py-3.5">
                        <ClassPill type={trade.asset_type} />
                      </td>
                      <td className="px-2 py-3.5">
                        <SidePill side={trade.side} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-3.5 text-xs text-zinc-400">
                        {qtyLabel(trade)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3.5 font-mono text-xs text-zinc-300">
                        {moneyPrice(trade.entry_price)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3.5 font-mono text-xs text-zinc-300">
                        {moneyPrice(trade.exit_price)}
                      </td>
                      <td className="max-w-[140px] truncate px-2 py-3.5 text-xs text-zinc-400">
                        {trade.setup_tag || "—"}
                      </td>
                      <td
                        className={clsx(
                          "whitespace-nowrap px-2 py-3.5 font-mono text-xs font-medium",
                          pnl == null
                            ? "text-zinc-600"
                            : pnl >= 0
                              ? "text-positive"
                              : "text-negative"
                        )}
                      >
                        {pnl == null ? "—" : formatMoney(pnl, { digits: Math.abs(pnl) < 10 ? 2 : 0 })}
                      </td>
                      <td className="max-w-[160px] truncate px-2 py-3.5 text-xs text-zinc-500">
                        {trade.notes?.trim() || "—"}
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/trades/${trade.id}`}
                            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteOne(trade)}
                            disabled={deleteTrade.isPending}
                            className="rounded-md p-1.5 text-zinc-500 transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DateField({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-9 w-[148px] rounded-lg border border-white/10 bg-zinc-900/80 pl-8 pr-2 text-xs text-white outline-none [color-scheme:dark] focus:border-primary/40"
      />
    </div>
  );
}

function ClassPill({ type }: { type: AssetType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium capitalize text-violet-300">
      <span className="opacity-70">⌁</span>
      {assetLabel(type)}
    </span>
  );
}

function SidePill({ side }: { side: TradeSide }) {
  const isLong = side === "long";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        isLong ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
      )}
    >
      {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {side}
    </span>
  );
}
