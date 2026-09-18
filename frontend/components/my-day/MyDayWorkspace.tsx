"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { DayPlanEvents } from "@/components/my-day/DayPlanEvents";
import { DayPlanGamePlan } from "@/components/my-day/DayPlanGamePlan";
import { MarketSentimentCard } from "@/components/my-day/MarketSentimentCard";
import { MyDayNotesCard } from "@/components/my-day/MyDayNotesCard";
import { MyDayReviewPanel } from "@/components/my-day/MyDayReviewPanel";
import { MyDayToolbar } from "@/components/my-day/MyDayToolbar";
import { MyDayTradingPanel } from "@/components/my-day/MyDayTradingPanel";
import { ViewMyDayControl } from "@/components/progress/ViewMyDayControl";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { useToast } from "@/components/ui/Toast";
import { localIso } from "@/lib/dateLocal";
import { useDayPlan } from "@/lib/hooks/useDayPlan";
import { useStartProgressDay } from "@/lib/hooks/useProgressTracker";
import { useTrades } from "@/lib/hooks/useTrades";
import {
  formatMyDayHeading,
  maxPlannableMyDay,
  myDayHref,
  parseMyDayDate,
  parseMyDayPhase,
  shiftMyDayDate,
  type MyDayPhase,
} from "@/lib/my-day";

export function MyDayWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { locale, dateKey } = useLocale();
  const { activeAccount, loading: accountsLoading, formatMoney } = useAccountPrefs();
  const { openFlow } = useAddTradeModal();
  const startDay = useStartProgressDay();
  const started = useRef<string | null>(null);

  const today = dateKey(new Date()) || localIso(new Date());
  const date = parseMyDayDate(searchParams.get("date"), today);
  const phase = parseMyDayPhase(searchParams.get("phase"));
  const accountId = activeAccount?.id;
  const heading = formatMyDayHeading(date, locale);
  const maxDate = maxPlannableMyDay(today);

  const planQuery = useDayPlan(accountId, date);
  const { data: trades = [], isLoading: tradesLoading } = useTrades(
    { account_id: accountId, date_from: `${date}T00:00:00`, date_to: `${date}T23:59:59`, limit: 500 },
    { enabled: !!accountId }
  );

  const dayTrades = useMemo(
    () => trades.filter((t) => (t.opened_at || t.closed_at || "").slice(0, 10) === date),
    [trades, date]
  );

  useEffect(() => {
    if (!accountId || date !== today || started.current === date) return;
    started.current = date;
    void startDay.mutateAsync(date).catch(() => {
      started.current = null;
    });
  }, [accountId, date, startDay, today]);

  function go(nextDate: string, nextPhase: MyDayPhase = phase) {
    if (nextDate > maxDate) {
      toast.info("You can plan up to 30 days ahead.");
      return;
    }
    router.replace(myDayHref(nextDate, nextPhase));
  }

  function setPhase(next: MyDayPhase) {
    go(date, next);
  }

  function startTrading() {
    setPhase("trading");
    openFlow();
  }

  const plan = planQuery.data;
  const planLoading = planQuery.isLoading;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <MyDayToolbar
        heading={heading}
        phase={phase}
        canGoForward={shiftMyDayDate(date, 1) <= maxDate}
        datePicker={<ViewMyDayControl accountId={accountId} variant="icon" selectedDate={date} />}
        onPrev={() => go(shiftMyDayDate(date, -1))}
        onNext={() => go(shiftMyDayDate(date, 1))}
        onPhase={setPhase}
        onStartTrading={startTrading}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {accountsLoading ? (
          <div className="mx-auto max-w-[1100px] space-y-3">
            <div className="h-36 animate-pulse rounded-xl bg-[var(--color-surface)]" />
            <div className="h-48 animate-pulse rounded-xl bg-[var(--color-surface)]" />
          </div>
        ) : !accountId ? (
          <p className="py-16 text-center text-sm text-[var(--color-text-muted)]">
            Create an account in Settings to plan a trading day.
          </p>
        ) : planQuery.isError ? (
          <div className="mx-auto max-w-[1100px] dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
            Couldn’t load this day’s plan.{" "}
            <button type="button" className="text-primary" onClick={() => void planQuery.refetch()}>
              Retry
            </button>
          </div>
        ) : phase === "trading" ? (
          <MyDayTradingPanel
            date={date}
            accountId={accountId}
            plan={plan}
            planLoading={planLoading}
            trades={dayTrades}
            loading={tradesLoading}
            formatMoney={formatMoney}
          />
        ) : phase === "review" ? (
          <MyDayReviewPanel date={date} dateLabel={heading} accountId={accountId} />
        ) : (
          <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3">
            <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
              <MarketSentimentCard
                plan={plan}
                accountId={accountId}
                date={date}
                tradeCount={dayTrades.length}
                loading={planLoading}
              />
              <DayPlanEvents
                plan={plan}
                accountId={accountId}
                date={date}
                locale={locale}
                loading={planLoading}
              />
            </div>
            <DayPlanGamePlan plan={plan} accountId={accountId} date={date} loading={planLoading} />
            <MyDayNotesCard accountId={accountId} date={date} />
          </div>
        )}
      </div>
    </div>
  );
}
