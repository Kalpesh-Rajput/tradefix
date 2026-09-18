"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { OverviewTab } from "@/components/reports/OverviewTab";
import { ReportChartGrid } from "@/components/reports/ReportChartGrid";
import { GoalsProgressCard } from "@/components/dashboard/GoalsProgressCard";
import { ReportsHeader } from "@/components/reports/ReportsHeader";
import { ReportsOverview } from "@/components/reports/ReportsOverview";
import { ReportsTabs } from "@/components/reports/ReportsTabs";
import { ReportWorkspace } from "@/components/reports/ReportWorkspace";
import { ShareCard } from "@/components/share/ShareCard";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildGoalProgress } from "@/lib/goals";
import {
  isAnalyticsReportId,
  parseHourBucket,
  parseReportSub,
  parseReportsView,
  parseTopN,
  REPORT_BY_ID,
  type ReportsView,
} from "@/lib/reports/catalog";
import { filterReportTrades } from "@/lib/reports/filter";
import { displayPnlForMode } from "@/lib/reports/pnlMode";
import type { ReportPnlMode } from "@/lib/reports/types";
import { TRADE_LIST_LIMIT } from "@/lib/trades/limits";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<ReportsPageSkeleton />}>
      <AnalyticsReports />
    </Suspense>
  );
}

function AnalyticsReports() {
  const { user } = useAuth();
  const { activeAccount, displayPnl, formatMoney, loading: accountsLoading } = useAccountPrefs();
  const { formatChartDate, dateKey, timezone } = useLocale();
  const { accentHex } = useAppearance();
  const accountId = activeAccount?.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = parseReportsView(searchParams.get("view"));
  const sub = isAnalyticsReportId(view) ? parseReportSub(view, searchParams.get("sub")) : "";
  const topN = parseTopN(searchParams.get("top"));
  const hourBucket = parseHourBucket(searchParams.get("bucket"));
  const useExit = searchParams.get("time") === "exit";

  const [pnlMode, setPnlMode] = useState<ReportPnlMode>("net");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [session, setSession] = useState("");
  const [symbol, setSymbol] = useState("");

  const replaceParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setView = useCallback(
    (next: ReportsView) => {
      if (next === view) return;
      if (next === "performance") {
        replaceParams({ view: null, sub: null, top: null, bucket: null, time: null });
        return;
      }
      if (next === "overview") {
        replaceParams({ view: "overview", sub: null, top: null, bucket: null, time: null });
        return;
      }
      const def = REPORT_BY_ID.get(next);
      replaceParams({
        view: next,
        sub: def?.defaultSub ?? null,
        top: def?.tabs.some((t) => t.ranked) ? String(topN) : null,
        bucket: next === "day-time" ? String(hourBucket) : null,
        time: next === "day-time" && useExit ? "exit" : null,
      });
    },
    [replaceParams, topN, hourBucket, useExit, view]
  );

  const accountReady = !!accountId;
  const filters = useMemo(
    () => ({
      account_id: accountId,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      session: session || undefined,
      symbol: symbol.trim() || undefined,
    }),
    [accountId, dateFrom, dateTo, session, symbol]
  );

  const overviewDisplayPnl = useMemo(() => displayPnlForMode(pnlMode), [pnlMode]);
  const isReport = isAnalyticsReportId(view);

  const { data, isLoading, isError, refetch } = useAnalytics(filters, { enabled: accountReady });
  const {
    data: trades = [],
    isLoading: tradesLoading,
    isError: tradesError,
    refetch: refetchTrades,
  } = useTrades(
    {
      account_id: accountId,
      date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
      date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
      limit: TRADE_LIST_LIMIT,
    },
    { enabled: accountReady }
  );
  const tradesTruncated = trades.length >= TRADE_LIST_LIMIT;

  const reportTrades = useMemo(
    () =>
      filterReportTrades(trades, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        session: session || undefined,
        symbol: symbol.trim() || undefined,
        dateKey,
      }),
    [trades, dateFrom, dateTo, session, symbol, dateKey]
  );

  const goalItems = useMemo(
    () => buildGoalProgress(user, reportTrades, displayPnl),
    [user, reportTrades, displayPnl]
  );

  const waiting = accountsLoading || tradesLoading || (!isReport && isLoading);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <ReportsHeader
        dateFrom={dateFrom}
        dateTo={dateTo}
        session={session}
        symbol={symbol}
        onRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
        onSession={setSession}
        onSymbol={setSymbol}
        onClearFilters={() => {
          setSession("");
          setSymbol("");
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
        <ReportsTabs
          tab={view}
          onChange={setView}
          trailing={
            data ? (
              <ShareCard
                overview={data.overview}
                formatMoney={formatMoney}
                accountName={activeAccount?.name}
                compact
              />
            ) : (
              <div className="h-8 w-[108px]" aria-hidden />
            )
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {tradesTruncated ? (
            <p className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
              Charts and dimension reports use the latest {TRADE_LIST_LIMIT.toLocaleString()} trades
              in this range. Performance summary KPIs still use the full selected period.
            </p>
          ) : null}
          {waiting ? (
            <ReportsSkeleton />
          ) : isReport && tradesError ? (
            <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-[var(--color-text-primary)]">
              Unable to load report data.{" "}
              <button type="button" onClick={() => refetchTrades()} className="text-primary hover:underline">
                Retry
              </button>
            </div>
          ) : isReport ? (
            <ReportWorkspace
              reportId={view}
              sub={sub}
              onSub={(next) => replaceParams({ sub: next })}
              trades={reportTrades}
              displayPnl={overviewDisplayPnl}
              pnlMode={pnlMode}
              onPnlMode={setPnlMode}
              formatMoney={formatMoney}
              timeZone={timezone}
              topN={topN}
              onTopN={(n) => replaceParams({ top: String(n) })}
              hourBucket={hourBucket}
              onHourBucket={(minutes) => replaceParams({ bucket: String(minutes) })}
              useExit={useExit}
              onUseExit={(next) => replaceParams({ time: next ? "exit" : null })}
            />
          ) : isError || !data ? (
            <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-[var(--color-text-primary)]">
              Couldn’t load reports.{" "}
              <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
                Try again
              </button>
            </div>
          ) : view === "overview" ? (
            <OverviewTab
              trades={reportTrades}
              displayPnl={overviewDisplayPnl}
              pnlMode={pnlMode}
              onPnlMode={setPnlMode}
              formatMoney={formatMoney}
              dateKey={dateKey}
              formatChartDate={formatChartDate}
              dateFrom={dateFrom || undefined}
              dateTo={dateTo || undefined}
              initialBalance={Number(activeAccount?.initial_balance ?? 0)}
            />
          ) : (
            <div className="space-y-3">
              <ReportChartGrid
                trades={reportTrades}
                displayPnl={displayPnl}
                formatMoney={formatMoney}
                dateKey={dateKey}
                formatChartDate={formatChartDate}
                dateFrom={dateFrom || undefined}
                dateTo={dateTo || undefined}
                initialBalance={Number(activeAccount?.initial_balance ?? 0)}
              />
              <ReportsOverview
                data={data}
                formatMoney={formatMoney}
                accentHex={accentHex}
                empty={data.overview.total_trades === 0}
                goals={<GoalsProgressCard items={goalItems} title="Goals" emptyHint={false} />}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-[12px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Skeleton className="h-[360px] rounded-[12px]" />
        <Skeleton className="h-[360px] rounded-[12px]" />
      </div>
    </div>
  );
}

function ReportsPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)] px-4 py-4 sm:px-6">
      <ReportsSkeleton />
    </div>
  );
}
