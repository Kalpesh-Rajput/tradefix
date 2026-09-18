"use client";

import { FileText, Share2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { DailyStats } from "@/components/dayview/DailyStats";
import { DayNoteEditor } from "@/components/dayview/notes/DayNoteEditor";
import { DETAIL_DAY_TRADE_COLUMNS, DayTradesTable } from "@/components/dayview/DayTradesTable";
import { PnLChart } from "@/components/dayview/PnLChart";
import { formatNetPnl, pnlHex } from "@/components/dayview/pnlStyle";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { parseLocalIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useDayNote } from "@/lib/hooks/useDayNotes";
import { useTrades } from "@/lib/hooks/useTrades";
import type { CalendarDay } from "@/lib/types";

function emptyDay(date: string): CalendarDay {
  return {
    date,
    trades: 0,
    pnl: 0,
    win_rate: 0,
    gross_pnl: 0,
    volume: 0,
    winners: 0,
    losers: 0,
    profit_factor: 0,
    commissions: 0,
    curve: [0, 0],
  };
}

function formatDayTitle(iso: string, locale: string) {
  return parseLocalIso(iso).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function DayDetailModal({
  date,
  day,
  onClose,
}: {
  date: string | null;
  day?: CalendarDay | null;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const { formatMoney, activeAccount } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const toast = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!date) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !noteOpen) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [date, noteOpen, onClose]);

  useEffect(() => {
    if (!date) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [date]);

  const iso = date?.slice(0, 10) ?? "";
  const { data: calendar, isLoading: calendarLoading } = useCalendar(iso, iso, accountId, {
    enabled: Boolean(iso && accountId),
  });
  const { data: trades = [], isLoading: tradesLoading } = useTrades(
    {
      account_id: accountId,
      date_from: `${iso}T00:00:00`,
      date_to: `${iso}T23:59:59`,
      status: "closed",
      limit: 500,
    },
    { enabled: Boolean(iso && accountId) }
  );
  const { data: note } = useDayNote(accountId, iso);

  const row = useMemo(() => {
    const fromApi = calendar?.days.find((item) => item.date.slice(0, 10) === iso);
    if (fromApi?.curve && fromApi.curve.length > 1) return fromApi;
    if (day?.curve && day.curve.length > 1) return day;
    return fromApi ?? day ?? emptyDay(iso);
  }, [calendar?.days, day, iso]);

  if (!date || !mounted) return null;

  const title = formatDayTitle(iso, locale);
  const pnl = Number(row.pnl);
  const loading = Boolean(accountId) && (calendarLoading || tradesLoading);
  const noteLabel = note ? t("dayView.viewNote") : t("dayView.addNote");

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(
        `${title} · ${trades.length} trades · ${formatMoney(pnl, { signed: true, digits: 2 })}`
      );
      toast.success(t("dayView.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  function openDetails() {
    router.push(`/day?date=${iso}`);
    onClose();
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-8">
        <button
          type="button"
          className="absolute inset-0 bg-black/25 backdrop-blur-[6px]"
          aria-label={t("common.close")}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="day-detail-title"
          className="relative z-10 my-auto flex max-h-[min(560px,calc(100dvh-4rem))] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2 id="day-detail-title" className="text-[16px] font-semibold tracking-tight text-[#1F2128]">
                  {title}
                </h2>
                <span className="text-[14px] font-semibold tabular-nums" style={{ color: pnlHex(pnl) }}>
                  {t("dayView.netPnl")} {formatNetPnl(pnl, formatMoney)}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {accountId ? (
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  className="dash-btn-primary h-8 px-3 text-[12px]"
                >
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {noteLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void copySummary()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E5EA] text-[#6B6E78] hover:bg-[#F7F8FA]"
                title={t("dayView.share")}
                aria-label={t("dayView.share")}
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6B6E78] hover:bg-[#F7F8FA]"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
            {loading ? (
              <div className="space-y-4 py-2">
                <div className="h-[168px] animate-pulse rounded-lg bg-[#F4F5F7]" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-md bg-[#F4F5F7]" />
                  ))}
                </div>
                <div className="h-24 animate-pulse rounded-lg bg-[#F4F5F7]" />
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <PnLChart
                    values={row.curve ?? [0, pnl]}
                    formatMoney={formatMoney}
                    className="h-[168px] w-full min-w-0 sm:w-[42%] sm:max-w-[420px] sm:shrink-0"
                  />
                  <DailyStats row={row} formatMoney={formatMoney} variant="detail" />
                </div>
                {trades.length > 0 ? (
                  <DayTradesTable
                    trades={trades}
                    formatMoney={formatMoney}
                    columns={DETAIL_DAY_TRADE_COLUMNS}
                    columnLabels={{
                      opened_at: t("dayView.col.openTime"),
                      symbol: t("dayView.col.ticker"),
                      pnl: t("dayView.col.netPnl"),
                    }}
                  />
                ) : (
                  <p className="mt-5 rounded-md border border-[#EEEFF2] bg-[#F7F8FA] px-4 py-6 text-center text-[13px] text-[#6B6E78]">
                    {t("dayView.noTradesDay")}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#EEEFF2] px-5 py-3 sm:px-6">
            <button type="button" onClick={onClose} className="dash-btn-secondary h-9 px-4 text-[12px]">
              {t("common.cancel")}
            </button>
            <button type="button" onClick={openDetails} className="dash-btn-primary h-9 px-4 text-[12px]">
              {t("dayView.viewDetails")}
            </button>
          </div>
        </div>
      </div>
      {noteOpen && accountId ? (
        <DayNoteEditor
          accountId={accountId}
          target={{
            date: iso,
            title,
            pnl,
            trades: row.trades,
            winRate: row.win_rate,
            day: row,
          }}
          formatMoney={formatMoney}
          onClose={() => setNoteOpen(false)}
        />
      ) : null}
    </>,
    document.body
  );
}
