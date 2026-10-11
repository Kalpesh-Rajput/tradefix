"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RevealGroup } from "@/components/motion/RevealGroup";
import { OverviewTab } from "@/components/reports/OverviewTab";
import { ReportChartGrid } from "@/components/reports/ReportChartGrid";
import { GoalsProgressCard } from "@/components/dashboard/GoalsProgressCard";
import { ReportsHeader } from "@/components/reports/ReportsHeader";
import { InsightsTab } from "@/components/reports/insights/InsightsTab";
import { ReportsTabs } from "@/components/reports/ReportsTabs";
import { ReportWorkspace } from "@/components/reports/ReportWorkspace";
import { ShareCard } from "@/components/share/ShareCard";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
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
import type { AdvancedFilters } from "@/lib/reports/advanced/query";
import { displayPnlForMode } from "@/lib/reports/pnlMode";
import type { ReportPnlMode } from "@/lib/reports/types";
import { usePublishAssistantScope } from "@/lib/ai/assistant-scope";
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
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("from") ?? "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("to") ?? "");
  const [session, setSession] = useState("");
  const [symbol, setSymbol] = useState("");
  const scopeDetail = [symbol && `Symbol ${symbol}`, session && `Session ${session}`].filter(Boolean).join(", ");
  usePublishAssistantScope({
    dateFrom,
    dateTo,
    detail: scopeDetail ? `Filters: ${scopeDetail}` : null,
  });

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
      if (next === "insights") {
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

  const advancedFilters = useMemo<AdvancedFilters | null>(
    () =>
      accountId
        ? {
            accountId,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            symbols: symbol.trim() ? [symbol.trim()] : undefined,
            sessions: session ? [session] : undefined,
            pnlMode,
          }
        : null,
    [accountId, dateFrom, dateTo, symbol, session, pnlMode]
  );

  const isInsights = view === "insights";
  const waiting = accountsLoading || (!isInsights && (tradesLoading || (!isReport && isLoading)));

  const truncationNotice = tradesTruncated ? (
    <p className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
      {isInsights
        ? `Custom charts use the latest ${TRADE_LIST_LIMIT.toLocaleString()} trades in this range. Every Insights section above uses your full history for the range.`
        : `Charts and dimension reports use the latest ${TRADE_LIST_LIMIT.toLocaleString()} trades in this range. Performance summary KPIs still use the full selected period.`}
    </p>
  ) : null;

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
          <RevealGroup>
          <div className="min-w-0">
          {!isInsights ? truncationNotice : null}
          {waiting ? (
            <ReportsSkeleton />
          ) : isInsights ? (
            advancedFilters ? (
              <InsightsTab
                filters={advancedFilters}
                formatMoney={formatMoney}
                onPnlMode={setPnlMode}
                goals={<GoalsProgressCard items={goalItems} title="Goals" emptyHint />}
                customCharts={
                  tradesLoading ? (
                    <Skeleton className="h-[360px] rounded-[12px]" />
                  ) : tradesError ? (
                    <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-[var(--color-text-primary)]">
                      Unable to load trades for custom charts.{" "}
                      <button type="button" onClick={() => refetchTrades()} className="text-primary hover:underline">
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {truncationNotice}
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
                    </>
                  )
                }
              />
            ) : (
              <div className="dash-card px-4 py-6 text-sm text-[var(--color-text-secondary)]">
                Select or create a trading account to see insights.
              </div>
            )
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
          ) : (
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
          )}
          </div>
          </RevealGroup>
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
