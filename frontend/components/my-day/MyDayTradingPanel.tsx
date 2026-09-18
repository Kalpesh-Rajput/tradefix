"use client";

import { DayTradesTable } from "@/components/dayview/DayTradesTable";
import { DayPlanGamePlan } from "@/components/my-day/DayPlanGamePlan";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import type { DayPlan } from "@/lib/my-day";
import type { Trade } from "@/lib/types";

export function MyDayTradingPanel({
  date,
  accountId,
  plan,
  planLoading,
  trades,
  loading,
  formatMoney,
}: {
  date: string;
  accountId?: string;
  plan?: DayPlan;
  planLoading?: boolean;
  trades: Trade[];
  loading: boolean;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { openFlow } = useAddTradeModal();

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3">
      <DayPlanGamePlan plan={plan} accountId={accountId} date={date} loading={planLoading} />
      <section className="dash-card overflow-hidden p-4">
        <div className="mb-3 flex h-11 items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Session trades</h2>
          <button type="button" onClick={() => openFlow()} className="dash-btn-primary text-on-accent">
            Add trade
          </button>
        </div>
        {loading ? (
          <div className="h-32 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
        ) : trades.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[var(--color-text-muted)]">
            No trades on this day yet. Start trading when the plan is set.
          </p>
        ) : (
          <DayTradesTable trades={trades} formatMoney={formatMoney} />
        )}
      </section>
    </div>
  );
}
