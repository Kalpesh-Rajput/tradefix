"use client";

import { Settings, Sun, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { DashboardCalendar } from "@/components/dashboard/zella/DashboardCalendar";
import { DayCard, type DayViewRow } from "@/components/dayview/DayCard";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { localIso, parseLocalIso, startOfWeekSunday } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";
import type { CalendarDay, Trade } from "@/lib/types";

const BANNER_KEY = "tradefix_dayview_accounts_banner";

function monthRange() {
  const now = new Date();
  return {
    from: localIso(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function formatDayTitle(iso: string, locale: string) {
  return parseLocalIso(iso).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mergeDays(days: CalendarDay[], id: string, title: string, date: string): DayViewRow {
  const pnl = days.reduce((s, d) => s + d.pnl, 0);
  const trades = days.reduce((s, d) => s + d.trades, 0);
  const winners = days.reduce((s, d) => s + (d.winners ?? 0), 0);
  const losers = days.reduce((s, d) => s + (d.losers ?? 0), 0);
  const gross = days.reduce((s, d) => s + (d.gross_pnl ?? d.pnl), 0);
  const volume = days.reduce((s, d) => s + (d.volume ?? 0), 0);
  const commissions = days.reduce((s, d) => s + (d.commissions ?? 0), 0);
  const grossWins = days.reduce((s, d) => s + Math.max(0, d.pnl), 0);
  const grossLosses = Math.abs(days.reduce((s, d) => s + Math.min(0, d.pnl), 0));
  const profit_factor = grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : grossWins > 0 ? Number(grossWins.toFixed(2)) : 0;
  const curve = days.flatMap((d, i) => (i === 0 ? d.curve ?? [0, d.pnl] : (d.curve ?? [d.pnl]).slice(1)));
  return {
    id,
    date,
    title,
    trades,
    pnl: Number(pnl.toFixed(2)),
    win_rate: trades ? Number(((winners / trades) * 100).toFixed(1)) : 0,
    gross_pnl: Number(gross.toFixed(2)),
    volume: Number(volume.toFixed(4)),
    winners,
    losers,
    profit_factor,
    commissions: Number(commissions.toFixed(2)),
    curve: curve.length ? curve : [0, pnl],
  };
}

export function DayViewPage() {
  const { t, locale } = useLocale();
  const { formatMoney, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const { openModal } = useAddTradeModal();
  const accountId = activeAccount?.id;
  const initial = useMemo(() => monthRange(), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [mode, setMode] = useState<"day" | "week">("day");
  const [bannerOpen, setBannerOpen] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(BANNER_KEY) === "1") setBannerOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const calStart = dateFrom;
  const calEnd = dateTo;

  const {
    data: calendar,
    isLoading,
    isError,
    refetch,
  } = useCalendar(calStart, calEnd, accountId, { enabled: !!accountId });

  const { data: trades = [] } = useTrades(
    {
      account_id: accountId,
      date_from: `${dateFrom}T00:00:00`,
      date_to: `${dateTo}T23:59:59`,
      status: "closed",
      limit: 1000,
    },
    { enabled: !!accountId }
  );

  const tradesByDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const trade of trades) {
      const key = (trade.closed_at || trade.opened_at).slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(trade);
      map.set(key, list);
    }
    return map;
  }, [trades]);

  const rows = useMemo<DayViewRow[]>(() => {
    const days = [...(calendar?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    if (mode === "day") {
      return days.map((d) => ({
        ...d,
        id: d.date.slice(0, 10),
        title: formatDayTitle(d.date.slice(0, 10), locale),
      }));
    }
    const groups = new Map<string, CalendarDay[]>();
    for (const d of days) {
      const week = localIso(startOfWeekSunday(parseLocalIso(d.date.slice(0, 10))));
      const list = groups.get(week) ?? [];
      list.push(d);
      groups.set(week, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, group]) =>
        mergeDays(group, week, t("dayView.weekOf", { date: formatDayTitle(week, locale) }), week)
      );
  }, [calendar?.days, mode, locale, t]);

  function dismissBanner() {
    setBannerOpen(false);
    try {
      window.localStorage.setItem(BANNER_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  function onSelectDate(date: string) {
    const el = document.getElementById(`day-${date}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const week = localIso(startOfWeekSunday(parseLocalIso(date)));
    document.getElementById(`day-${week}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <header className="z-20 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{t("dayView.title")}</h1>
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground text-on-accent">
              $
            </span>
            <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }} />
            <PortfolioSwitcher className="[&_button]:h-7 [&_button]:rounded-md [&_button]:text-[11px]" />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex gap-3 p-3 sm:p-4">
          <div className="min-w-0 flex-1 space-y-3">
            {bannerOpen && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-[var(--color-surface)] px-3 py-2">
                <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground text-on-accent">
                  {t("common.new")}
                </span>
                <p className="min-w-0 flex-1 text-[12px] text-[var(--color-text-secondary)]">{t("dayView.banner")}</p>
                <Link
                  href="/settings/accounts"
                  className="inline-flex h-7 items-center rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover"
                >
                  {t("dayView.toAccounts")}
                </Link>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-primary-very-light)]"
                  aria-label={t("common.closeMenu")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
                {(["day", "week"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={
                      mode === id
                        ? "rounded bg-primary px-2.5 py-1 text-[12px] font-semibold text-primary-foreground text-on-accent"
                        : "rounded px-2.5 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }
                  >
                    {id === "day" ? t("dayView.day") : t("dayView.week")}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/diary"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover"
                >
                  <Sun className="h-3.5 w-3.5" />
                  {t("dayView.startMyDay")}
                </Link>
                <Link
                  href="/settings/trading-defaults"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-primary"
                  aria-label={t("common.settings")}
                  title={t("common.settings")}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-28 rounded-md" />
                <Skeleton className="h-28 rounded-md" />
              </div>
            ) : isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm">
                {t("dayView.loadError")}{" "}
                <button type="button" onClick={() => void refetch()} className="text-primary hover:underline">
                  {t("common.retry")}
                </button>
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
                <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{t("dayView.empty")}</p>
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{t("dayView.emptyHint")}</p>
                <button
                  type="button"
                  onClick={() => openModal("manual")}
                  className="mt-4 inline-flex h-8 items-center rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover"
                >
                  {t("common.addTrade")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <DayCard
                    key={row.id}
                    row={row}
                    formatMoney={formatMoney}
                    trades={
                      mode === "day"
                        ? tradesByDay.get(row.id) ?? []
                        : [...tradesByDay.entries()]
                            .filter(([day]) => {
                              const week = localIso(startOfWeekSunday(parseLocalIso(day)));
                              return week === row.id;
                            })
                            .flatMap(([, list]) => list)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="hidden w-[248px] shrink-0 xl:block">
            <DashboardCalendar
              days={calendar?.days ?? []}
              onMonthChange={(start, end) => {
                setDateFrom(start);
                setDateTo(end);
              }}
              onSelectDate={onSelectDate}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
