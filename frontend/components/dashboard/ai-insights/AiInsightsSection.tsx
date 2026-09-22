"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useAiInsights, useRefreshAiInsights } from "@/lib/hooks/useAiInsights";

import { EmptyInsights } from "./EmptyInsights";
import { FocusCard } from "./FocusCard";
import { InsightCard } from "./InsightCard";
import { InsightsSummary } from "./InsightsSummary";
import { WeeklyCard } from "./WeeklyCard";

export function AiInsightsSection({
  accountId,
  formatMoney,
}: {
  accountId?: string;
  formatMoney: (n: number, opts?: { signed?: boolean }) => string;
}) {
  const { data, isLoading, isError, refetch } = useAiInsights(accountId, { enabled: !!accountId });
  const refresh = useRefreshAiInsights(accountId);

  if (!accountId || isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-[92px] rounded-[10px]" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-[220px] rounded-[10px]" />
          <Skeleton className="h-[220px] rounded-[10px]" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-foreground">
        Couldn’t load TradeFix AI Insights.
        <button type="button" className="ml-3 text-primary" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  if (!data.enough_data) {
    return <EmptyInsights tradesAnalysed={data.trades_analysed} />;
  }

  return (
    <div className="space-y-3">
      {data.summary ? <InsightsSummary summary={data.summary} /> : null}
      {data.insights.length > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
          {data.insights.map((card) => (
            <InsightCard key={card.id} card={card} />
          ))}
        </div>
      ) : (
        <EmptyInsights tradesAnalysed={data.trades_analysed} />
      )}
      {data.focus ? <FocusCard focus={data.focus} /> : null}
      {data.weekly ? <WeeklyCard weekly={data.weekly} formatMoney={formatMoney} /> : null}
      <div className="flex justify-end">
        <button
          type="button"
          className="text-[11px] text-[var(--color-text-tertiary)] hover:text-primary"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? "Refreshing insights…" : "Refresh insights"}
        </button>
      </div>
    </div>
  );
}
