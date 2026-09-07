"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DayNoteEditor } from "@/components/dayview/notes/DayNoteEditor";
import { NotebookSidebar, type NotebookTab } from "@/components/notebook/NotebookSidebar";
import { TradeNotePanel } from "@/components/notebook/TradeNotePanel";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { localIso, parseLocalIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useDayNotes } from "@/lib/hooks/useDayNotes";
import { useTrades } from "@/lib/hooks/useTrades";

function formatTitle(iso: string, locale: string) {
  return parseLocalIso(iso).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function notePreview(text: string | null | undefined) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Screenshots only";
  return clean.length > 72 ? `${clean.slice(0, 72)}…` : clean;
}

export function NotebookPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { formatMoney, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const [mobileList, setMobileList] = useState(true);
  const [dirty, setDirty] = useState(false);

  const tab: NotebookTab = params.get("tab") === "trades" ? "trades" : "daily";
  const requestedDate = params.get("date")?.slice(0, 10) || params.get("note");
  const requestedTrade = params.get("trade");

  const { data: notes = [], isLoading: notesLoading } = useDayNotes(accountId);
  const { data: journalTrades = [], isLoading: tradesLoading } = useTrades(
    { account_id: accountId, has_journal: true, limit: 500 },
    { enabled: !!accountId }
  );

  const selectedDate = useMemo(() => {
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return requestedDate;
    if (requestedDate) {
      const match = notes.find((n) => n.id === requestedDate);
      if (match) return match.date.slice(0, 10);
    }
    return notes[0]?.date.slice(0, 10) ?? localIso(new Date());
  }, [requestedDate, notes]);

  const selectedTradeId = useMemo(() => {
    if (requestedTrade && journalTrades.some((t) => t.id === requestedTrade)) return requestedTrade;
    if (requestedTrade) return requestedTrade;
    return journalTrades[0]?.id ?? null;
  }, [requestedTrade, journalTrades]);

  const monthBounds = useMemo(() => {
    const cursor = parseLocalIso(selectedDate);
    return {
      start: localIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      end: localIso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
    };
  }, [selectedDate]);

  const { data: calendar } = useCalendar(monthBounds.start, monthBounds.end, accountId, {
    enabled: !!accountId && tab === "daily",
  });
  const day = calendar?.days.find((d) => d.date.slice(0, 10) === selectedDate);

  const guard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes?");
  }, [dirty]);

  function push(next: URLSearchParams) {
    router.push(`/notebook?${next.toString()}`, { scroll: false });
  }

  function selectTab(next: NotebookTab) {
    if (next === tab) return;
    if (!guard()) return;
    const qs = new URLSearchParams();
    qs.set("tab", next);
    if (next === "daily") qs.set("date", selectedDate);
    else if (selectedTradeId) qs.set("trade", selectedTradeId);
    setDirty(false);
    setMobileList(true);
    push(qs);
  }

  function selectDate(date: string) {
    if (date === selectedDate && tab === "daily") {
      setMobileList(false);
      return;
    }
    if (!guard()) return;
    setDirty(false);
    setMobileList(false);
    const qs = new URLSearchParams({ tab: "daily", date });
    push(qs);
  }

  function selectTrade(id: string) {
    if (id === selectedTradeId && tab === "trades") {
      setMobileList(false);
      return;
    }
    if (!guard()) return;
    setDirty(false);
    setMobileList(false);
    push(new URLSearchParams({ tab: "trades", trade: id }));
  }

  useEffect(() => {
    if (tab !== "daily") return;
    if (!params.get("date") && selectedDate) {
      router.replace(`/notebook?tab=daily&date=${selectedDate}`, { scroll: false });
    }
  }, [params, selectedDate, router, tab]);

  const loading = accountsLoading || (!!accountId && (tab === "daily" ? notesLoading : tradesLoading));

  const dailyItems = notes.map((note) => ({
    id: note.id,
    date: note.date.slice(0, 10),
    title: formatTitle(note.date.slice(0, 10), locale),
    favorite: note.is_favorite,
    shots: note.screenshot_urls?.length ?? 0,
  }));

  const tradeItems = journalTrades.map((trade) => ({
    id: trade.id,
    title: `${trade.symbol} · ${trade.side}`,
    subtitle: `${formatTitle((trade.closed_at || trade.opened_at).slice(0, 10), locale)} · ${notePreview(trade.notes)}`,
    pnl: Number(trade.pnl ?? 0),
    shots: trade.screenshot_urls?.length ?? 0,
    hasNote: Boolean(trade.notes?.trim()),
  }));

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--color-background)]">
      <div className={mobileList ? "flex h-full min-h-0 w-full md:w-auto" : "hidden md:flex"}>
        <NotebookSidebar
          tab={tab}
          onTabChange={selectTab}
          dailyItems={dailyItems}
          tradeItems={tradeItems}
          selectedDate={selectedDate}
          selectedTradeId={selectedTradeId}
          onSelectDate={selectDate}
          onSelectTrade={selectTrade}
          loading={loading}
          formatMoney={formatMoney}
        />
      </div>

      <div className={mobileList ? "hidden min-w-0 flex-1 md:flex md:flex-col" : "flex min-w-0 flex-1 flex-col"}>
        <div className="flex h-11 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 md:hidden">
          <button
            type="button"
            onClick={() => setMobileList(true)}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Notes
          </button>
        </div>

        {!accountId ? (
          <div className="p-6 text-sm text-[var(--color-text-secondary)]">Select a portfolio to open notes.</div>
        ) : tab === "daily" ? (
          <DayNoteEditor
            accountId={accountId}
            variant="page"
            onDirtyChange={setDirty}
            target={{
              date: selectedDate,
              title: formatTitle(selectedDate, locale),
              pnl: day?.pnl ?? 0,
              trades: day?.trades ?? 0,
              winRate: day?.win_rate ?? 0,
            }}
            formatMoney={formatMoney}
          />
        ) : selectedTradeId ? (
          <TradeNotePanel
            key={selectedTradeId}
            tradeId={selectedTradeId}
            locale={locale}
            formatMoney={formatMoney}
            onDirtyChange={setDirty}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="text-[14px] font-medium text-[var(--color-text-primary)]">No trade notes yet</p>
              <p className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">
                Add notes or screenshots on a trade and they will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
