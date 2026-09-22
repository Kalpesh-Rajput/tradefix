"use client";

import Link from "next/link";

import { FocusCard } from "@/components/dashboard/ai-insights/FocusCard";
import { InsightCard } from "@/components/dashboard/ai-insights/InsightCard";
import { InsightsSummary } from "@/components/dashboard/ai-insights/InsightsSummary";
import { WeeklyCard } from "@/components/dashboard/ai-insights/WeeklyCard";
import { EmptyInsights } from "@/components/dashboard/ai-insights/EmptyInsights";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAiInsights, useRefreshAiInsights } from "@/lib/hooks/useAiInsights";

export default function AiReviewPage() {
  const { activeAccount, formatMoney } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const { data, isLoading, isError, refetch } = useAiInsights(accountId, { enabled: !!accountId });
  const refresh = useRefreshAiInsights(accountId);

  return (
    <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">
            <Link href="/today" className="hover:text-primary">
              Dashboard
            </Link>
            <span className="mx-1.5">/</span>
            AI Review
          </p>
          <h1 className="mt-1 text-[18px] font-semibold text-[var(--color-text-primary)]">Your full AI review</h1>
        </div>
        <button
          type="button"
          className="text-[12px] text-primary hover:underline disabled:opacity-50"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!accountId || isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-[88px] rounded-[10px]" />
          <Skeleton className="h-[160px] rounded-[10px]" />
        </div>
      ) : isError ? (
        <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-4 text-sm">
          Couldn’t load this review.
          <button type="button" className="ml-3 text-primary" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : !data || !data.enough_data ? (
        <EmptyInsights tradesAnalysed={data?.trades_analysed ?? 0} />
      ) : (
        <div className="space-y-3">
          {data.summary ? <InsightsSummary summary={data.summary} /> : null}
          {data.weekly ? <WeeklyCard weekly={data.weekly} formatMoney={formatMoney} /> : null}
          {data.focus ? <FocusCard focus={data.focus} /> : null}
          {data.insights.length > 0 ? (
            <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
              {data.insights.map((card) => (
                <InsightCard key={card.id} card={card} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
