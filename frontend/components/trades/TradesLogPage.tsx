"use client";

import clsx from "clsx";
import { ClipboardList, Filter, Menu, Plus, Search, Trash2, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { BackButton } from "@/components/layout/AppNavigation";
import { NavCollapseButton } from "@/components/layout/NavCollapseButton";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useQuickLog } from "@/components/providers/QuickLogProvider";
import { useSidebar } from "@/components/providers/SidebarProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { AdvancedFilterDialog } from "@/components/trades/AdvancedFilterDialog";
import { ColumnPickerDialog, useTradeColumnPrefs } from "@/components/trades/ColumnPickerDialog";
import { TradeLogTable } from "@/components/trades/TradeLogTable";
import { TradeViewKpis } from "@/components/trades/TradeViewKpis";
import { TradePreviewDrawer } from "@/components/trades/preview/TradePreviewDrawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { usePublishAssistantScope } from "@/lib/ai/assistant-scope";
import { useDeleteTrade, useDeleteTrades, useTrades } from "@/lib/hooks/useTrades";
import { isJournalPath } from "@/lib/nav";
import type { Trade } from "@/lib/types";
import { columnsAreDefault } from "@/lib/trades/logColumns";
import {
  DEFAULT_FILTERS,
  advancedFilterCount,
  completeFilters,
  filtersFromSearch,
  hasUrlInsightFilters,
  matchesTrade,
  type LocalFilters,
} from "@/lib/trades/logFilters";

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

const FILTERS_STORAGE_KEY = "tradefix_trades_log_filters";

const fieldClass =
  "h-9 rounded-xl border border-[#E2E2E7] bg-white text-[13px] text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-primary/40";

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
  const { t } = useLocale();
  const pathname = usePathname();
  const toast = useToast();
  const { openFlow } = useAddTradeModal();
  const { openQuickLog } = useQuickLog();
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { activeAccount, displayPnl, formatMoney, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const showJournalToggle = isJournalPath(pathname) && collapsed;

  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<LocalFilters>(DEFAULT_FILTERS);
  const { columns, setColumns } = useTradeColumnPrefs();
  const [columnsOpen, setColumnsOpen] = useState(false);
  const tradeScopeDetail = [
    filters.symbol && `Symbol ${filters.symbol}`,
    filters.setup_tag && `Setup ${filters.setup_tag}`,
    filters.session && `Session ${filters.session}`,
    filters.side && `Side ${filters.side}`,
  ]
    .filter(Boolean)
    .join(", ");
  usePublishAssistantScope({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    detail: tradeScopeDetail ? `Filters: ${tradeScopeDetail}` : null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [previewTradeId, setPreviewTradeId] = useState<string | null>(null);

  const deleteTrade = useDeleteTrade();
  const deleteTrades = useDeleteTrades();

  useEffect(() => {
    const fromUrl = filtersFromSearch(searchParams);
    if (hasUrlInsightFilters(searchParams)) {
      setFilters(
        completeFilters({
          ...fromUrl,
          status: fromUrl.status ?? "closed",
        })
      );
      setHydrated(true);
      return;
    }
    if (user?.save_filters) {
      setFilters(completeFilters(readStored()));
    }
    setHydrated(true);
  }, [user?.save_filters, searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user?.save_filters) {
      window.localStorage.removeItem(FILTERS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters, user?.save_filters, hydrated]);

  const selectionKey = [
    filters.status,
    filters.search,
    filters.dateFrom,
    filters.dateTo,
    filters.asset_type,
    filters.side,
    filters.setup_tag,
    filters.symbol,
    filters.session,
    filters.holding,
    filters.pnl,
    filters.fees,
    filters.risk,
    filters.roi,
    filters.rating,
    filters.r_multiple,
    filters.weekday,
    filters.mood,
    filters.emotion,
    filters.journal,
    filters.rules,
    accountId ?? "",
  ].join("|");

  useEffect(() => {
    setSelected(new Set());
  }, [selectionKey]);

  const apiFilters = useMemo(
    () => ({
      account_id: accountId,
      date_from: filters.dateFrom ? `${filters.dateFrom}T00:00:00` : undefined,
      date_to: filters.dateTo ? `${filters.dateTo}T23:59:59` : undefined,
      ids: filters.ids || undefined,
      auto_flag: filters.auto_flag || undefined,
      limit: 1000,
    }),
    [accountId, filters.dateFrom, filters.dateTo, filters.ids, filters.auto_flag]
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

  const filtered = useMemo(
    () => trades.filter((trade) => matchesTrade(trade, filters, displayPnl)),
    [trades, filters, displayPnl]
  );

  const outcomeTrades = useMemo(
    () => trades.filter((trade) => matchesTrade(trade, { ...filters, pnl: "" }, displayPnl)),
    [trades, filters, displayPnl]
  );

  const counts = useMemo(() => {
    const base = trades.filter((trade) => matchesTrade(trade, filters, displayPnl, { ignoreStatus: true }));
    return {
      all: base.length,
      open: base.filter((trade) => trade.status === "open").length,
      closed: base.filter((trade) => trade.status === "closed").length,
    };
  }, [trades, filters, displayPnl]);

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
      if (previewTradeId === trade.id) setPreviewTradeId(null);
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
      if (previewTradeId && ids.includes(previewTradeId)) setPreviewTradeId(null);
      setSelected(new Set());
      toast.success(`${ids.length} trade${ids.length === 1 ? "" : "s"} deleted`);
    } catch (err) {
      toast.error("Could not delete trades", err instanceof Error ? err.message : undefined);
    }
  }

  const activeFilterCount = advancedFilterCount(filters);
  const columnsCustomized = !columnsAreDefault(columns);
  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 pb-3 pt-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text-primary)] md:hidden"
              aria-label={mobileOpen ? t("common.closeMenu") : t("common.openMenu")}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {showJournalToggle && <NavCollapseButton variant="light" />}
            <BackButton />
            <h1 className="truncate text-[20px] font-semibold tracking-tight text-[var(--color-text-primary)]">
              Trade View
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PortfolioSwitcher iconOnly />
            <button
              type="button"
              onClick={() => openQuickLog(lastClosedTradeId)}
              disabled={!lastClosedTradeId}
              className={iconBtnClass}
              aria-label="Quick Log"
              title={lastClosedTradeId ? "Quick Log" : "No closed trades yet"}
            >
              <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Search symbol or strategy…"
              className={clsx(fieldClass, "w-full pl-9 pr-3")}
            />
          </div>

          <div className="shrink-0">
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onChange={(from, to) => setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }))}
              triggerClassName="h-9 rounded-xl border-[#E2E2E7] text-[13px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={clsx(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition-colors duration-150",
              activeFilterCount > 0 || filtersOpen
                ? "border-primary/40 bg-[var(--color-primary-light)] text-primary"
                : "border-[#E2E2E7] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            )}
          >
            <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
            Advance Filter
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex shrink-0 items-center rounded-xl border border-[#E2E2E7] bg-white p-0.5">
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
                  "h-8 rounded-lg px-3 text-xs font-medium transition-colors duration-150",
                  filters.status === tab.key
                    ? "bg-[var(--color-primary-light)] text-primary"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {tab.label}{" "}
                <span className="tabular-nums text-[var(--color-text-tertiary)]">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {someSelected && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-very-light)] px-3 py-2">
            <span className="text-xs font-medium text-[var(--color-text-primary)]">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleteTrades.isPending}
              className="inline-flex items-center gap-1 text-xs font-medium text-negative hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-auto rounded p-0.5 text-[var(--color-text-tertiary)] hover:bg-white hover:text-[var(--color-text-primary)]"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      <div className="shrink-0 px-5 pt-4 sm:px-6">
        <TradeViewKpis
          trades={filtered}
          outcomeTrades={outcomeTrades}
          outcome={filters.pnl === "profit" || filters.pnl === "loss" ? filters.pnl : ""}
          onOutcome={(next) => setFilters((current) => ({ ...current, pnl: next }))}
          loading={loading}
          formatMoney={formatMoney}
          displayPnl={displayPnl}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-4 sm:px-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-[var(--color-text-primary)]">
            Couldn’t load trades.{" "}
            <button type="button" onClick={() => refetch()} className="font-medium text-primary hover:underline">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dash-card border-dashed px-6 py-16 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {trades.length === 0
                ? "No trades yet — add your first trade or import a CSV."
                : "No trades match these filters."}
            </p>
            {trades.length === 0 && (
              <button
                type="button"
                onClick={() => openFlow()}
                className="dash-btn-primary text-on-accent mt-4"
              >
                <Plus className="h-4 w-4" />
                Add Trade
              </button>
            )}
          </div>
        ) : (
          <div className="dash-card flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <TradeLogTable
              trades={filtered}
              columns={columns}
              selected={selected}
              allVisibleSelected={allVisibleSelected}
              previewTradeId={previewTradeId}
              deletePending={deleteTrade.isPending}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onPreview={setPreviewTradeId}
              onDelete={handleDeleteOne}
              onSelectColumns={() => setColumnsOpen(true)}
              columnsActive={columnsCustomized || columnsOpen}
            />
          </div>
        )}
      </div>

      {previewTradeId ? (
        <TradePreviewDrawer
          tradeId={previewTradeId}
          trades={filtered}
          formatMoney={formatMoney}
          onClose={() => setPreviewTradeId(null)}
          onSelectTrade={setPreviewTradeId}
        />
      ) : null}

      <ColumnPickerDialog
        open={columnsOpen}
        columns={columns}
        onClose={() => setColumnsOpen(false)}
        onSave={(next) => {
          setColumns(next);
          setColumnsOpen(false);
        }}
      />
      <AdvancedFilterDialog
        open={filtersOpen}
        filters={filters}
        trades={trades}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters((current) => ({ ...current, ...next }));
          setFiltersOpen(false);
        }}
      />
    </div>
  );
}
