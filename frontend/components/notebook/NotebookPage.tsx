"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DayNoteEditor } from "@/components/dayview/notes/DayNoteEditor";
import { formatNoteTitle, formatNumericDate, notePreview } from "@/components/notebook/dateFormat";
import { NotebookFolders } from "@/components/notebook/NotebookFolders";
import { NotebookNoteList } from "@/components/notebook/NotebookNoteList";
import { NotebookRecapPanel } from "@/components/notebook/NotebookRecapPanel";
import { NotebookSearchBar } from "@/components/notebook/NotebookSearchBar";
import { TradeNotePanel } from "@/components/notebook/TradeNotePanel";
import {
  FOLDERS_COLLAPSE_KEY,
  isCustomFolderId,
  parseFolder,
  type NotebookFolderId,
  type NotebookListItem,
  type NotebookPane,
  type NotebookSort,
} from "@/components/notebook/types";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { localIso, parseLocalIso } from "@/lib/dateLocal";
import { useCalendar } from "@/lib/hooks/useAnalytics";
import { useDayNotes } from "@/lib/hooks/useDayNotes";
import { useNotebookFolders } from "@/lib/hooks/useNotebookFolders";
import { useRecaps } from "@/lib/hooks/useRecaps";
import { useTrades } from "@/lib/hooks/useTrades";

export function NotebookPage() {
  const { locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { formatMoney, activeAccount, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const [mobilePane, setMobilePane] = useState<NotebookPane>("list");
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<NotebookSort>("newest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const folder = parseFolder(params);
  const requestedDate = params.get("date")?.slice(0, 10) || params.get("note");
  const requestedTrade = params.get("trade");

  const { data: notes = [], isLoading: notesLoading } = useDayNotes(accountId);
  const { data: customFolders = [] } = useNotebookFolders(accountId);
  const { data: journalTrades = [], isLoading: tradesLoading } = useTrades(
    { account_id: accountId, has_journal: true, limit: 500 },
    { enabled: !!accountId }
  );
  const { data: recaps = [], isLoading: recapsLoading } = useRecaps(accountId);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FOLDERS_COLLAPSE_KEY);
      if (raw === "1" || raw === "true") setFoldersCollapsed(true);
      else if (raw === "0" || raw === "false") setFoldersCollapsed(false);
      else if (window.matchMedia("(max-width: 1023px)").matches) setFoldersCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleFolders() {
    setFoldersCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(FOLDERS_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const selectedDate = useMemo(() => {
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return requestedDate;
    if (requestedDate) {
      const match = notes.find((n) => n.id === requestedDate);
      if (match) return match.date.slice(0, 10);
    }
    if (folder === "recaps") return recaps[0]?.date.slice(0, 10) ?? localIso(new Date());
    if (folder === "favorites") {
      const fav = notes.find((n) => n.is_favorite);
      return fav?.date.slice(0, 10) ?? notes[0]?.date.slice(0, 10) ?? localIso(new Date());
    }
    if (isCustomFolderId(folder)) {
      const match = notes.find((n) => n.folder_id === folder);
      return match?.date.slice(0, 10) ?? localIso(new Date());
    }
    return notes[0]?.date.slice(0, 10) ?? localIso(new Date());
  }, [requestedDate, notes, recaps, folder]);

  const selectedTradeId = useMemo(() => {
    if (requestedTrade && journalTrades.some((t) => t.id === requestedTrade)) return requestedTrade;
    if (requestedTrade) return requestedTrade;
    return journalTrades[0]?.id ?? null;
  }, [requestedTrade, journalTrades]);

  const showingTrade = folder === "trades" || (folder === "all" && Boolean(requestedTrade) && !requestedDate);

  const monthBounds = useMemo(() => {
    const cursor = parseLocalIso(selectedDate);
    return {
      start: localIso(new Date(cursor.getFullYear(), cursor.getMonth(), 1)),
      end: localIso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)),
    };
  }, [selectedDate]);

  const { data: calendar } = useCalendar(monthBounds.start, monthBounds.end, accountId, {
    enabled: !!accountId && !showingTrade && folder !== "recaps",
  });
  const day = calendar?.days.find((d) => d.date.slice(0, 10) === selectedDate);

  const guard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes?");
  }, [dirty]);

  function push(next: URLSearchParams) {
    router.push(`/notebook?${next.toString()}`, { scroll: false });
  }

  function folderParams(nextFolder: NotebookFolderId) {
    const qs = new URLSearchParams();
    qs.set("folder", nextFolder);
    qs.set("tab", nextFolder === "trades" ? "trades" : "daily");
    return qs;
  }

  function selectFolder(next: NotebookFolderId) {
    if (next === folder) {
      setMobilePane("list");
      return;
    }
    if (!guard()) return;
    const qs = folderParams(next);
    if (next === "trades") {
      if (selectedTradeId) qs.set("trade", selectedTradeId);
    } else if (next === "recaps") {
      qs.set("date", selectedDate);
    } else {
      qs.set("date", selectedDate);
    }
    setDirty(false);
    setMobilePane("list");
    push(qs);
  }

  function selectDate(date: string, nextFolder: NotebookFolderId = folder === "trades" ? "daily" : folder) {
    if (date === selectedDate && folder === nextFolder && !showingTrade) {
      setMobilePane("editor");
      return;
    }
    if (!guard()) return;
    setDirty(false);
    setMobilePane("editor");
    const qs = folderParams(nextFolder === "trades" ? "daily" : nextFolder);
    qs.set("date", date);
    push(qs);
  }

  function selectTrade(id: string, nextFolder: NotebookFolderId = folder === "all" ? "all" : "trades") {
    if (id === selectedTradeId && (folder === "trades" || folder === "all") && showingTrade) {
      setMobilePane("editor");
      return;
    }
    if (!guard()) return;
    setDirty(false);
    setMobilePane("editor");
    const qs = folderParams(nextFolder);
    qs.set("trade", id);
    push(qs);
  }

  function selectItem(item: NotebookListItem) {
    if (item.kind === "trade") selectTrade(item.id, folder === "all" ? "all" : "trades");
    else selectDate(item.date, item.kind === "recap" ? "recaps" : folder === "all" ? "all" : folder);
  }

  function logDay(date: string) {
    if (folder === "recaps") selectDate(date, "recaps");
    else if (isCustomFolderId(folder) || folder === "all" || folder === "favorites") selectDate(date, folder);
    else selectDate(date, "daily");
  }

  useEffect(() => {
    if (folder === "trades") return;
    if (folder === "all" && requestedTrade && !params.get("date")) return;
    if (folder === "favorites" && !notes.some((note) => note.is_favorite) && !params.get("date")) return;
    if (!params.get("date") && selectedDate) {
      const qs = new URLSearchParams();
      qs.set("folder", folder);
      qs.set("tab", "daily");
      qs.set("date", selectedDate);
      router.replace(`/notebook?${qs.toString()}`, { scroll: false });
    }
  }, [params, selectedDate, router, folder, requestedTrade, notes]);

  const dailyItems = useMemo(
    () =>
      notes.map((note) => ({
        kind: "day" as const,
        id: note.id,
        date: note.date.slice(0, 10),
        title: formatNoteTitle(note.date.slice(0, 10), locale),
        numericDate: formatNumericDate(note.date.slice(0, 10)),
        favorite: note.is_favorite,
        shots: note.screenshot_urls?.length ?? 0,
        folderId: note.folder_id ?? null,
      })),
    [notes, locale]
  );

  const tradeItems = useMemo(
    () =>
      journalTrades.map((trade) => ({
        kind: "trade" as const,
        id: trade.id,
        date: (trade.closed_at || trade.opened_at).slice(0, 10),
        title: `${trade.symbol} · ${trade.side}`,
        subtitle: `${formatNoteTitle((trade.closed_at || trade.opened_at).slice(0, 10), locale)} · ${notePreview(trade.notes)}`,
        pnl: Number(trade.pnl ?? 0),
        shots: trade.screenshot_urls?.length ?? 0,
        hasNote: Boolean(trade.notes?.trim()),
      })),
    [journalTrades, locale]
  );

  const recapItems = useMemo(
    () =>
      recaps.map((recap) => ({
        kind: "recap" as const,
        id: recap.id,
        date: recap.date.slice(0, 10),
        title: formatNoteTitle(recap.date.slice(0, 10), locale),
        numericDate: formatNumericDate(recap.date.slice(0, 10)),
        subtitle: recap.day_mood ?? "Recap",
      })),
    [recaps, locale]
  );

  const listItems = useMemo(() => {
    let items: NotebookListItem[] = [];
    if (folder === "trades") items = tradeItems;
    else if (folder === "recaps") items = recapItems;
    else if (folder === "favorites") items = dailyItems.filter((item) => item.favorite);
    else if (folder === "all") items = [...dailyItems, ...tradeItems];
    else if (isCustomFolderId(folder)) items = dailyItems.filter((item) => item.folderId === folder);
    else items = dailyItems;

    if (dateFrom && dateTo) {
      items = items.filter((item) => item.date >= dateFrom && item.date <= dateTo);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter((item) => {
        if (item.kind === "trade") {
          return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.date.includes(q);
        }
        return item.title.toLowerCase().includes(q) || item.date.includes(q) || item.numericDate.includes(q);
      });
    }
    if (favoritesOnly && (folder === "all" || folder === "daily")) {
      items = items.filter((item) => item.kind !== "day" || item.favorite);
    }
    items = [...items].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      return sort === "newest" ? cmp : -cmp;
    });
    return items;
  }, [folder, dailyItems, tradeItems, recapItems, query, sort, favoritesOnly, dateFrom, dateTo]);

  const loading =
    accountsLoading ||
    (!!accountId &&
      (folder === "trades" ? tradesLoading : folder === "recaps" ? recapsLoading : folder === "all" ? notesLoading || tradesLoading : notesLoading));

  const showDayEditor = !showingTrade && folder !== "recaps";
  const showRecap = folder === "recaps";
  const hasTrade = Boolean(selectedTradeId);
  const hasFavorite = dailyItems.some((item) => item.favorite);
  const editorEmpty =
    (folder === "favorites" && !hasFavorite && !requestedDate) ||
    (folder === "trades" && !hasTrade) ||
    (folder === "all" && dailyItems.length === 0 && tradeItems.length === 0 && !requestedDate);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <div className={mobilePane === "editor" ? "hidden md:block" : "block"}>
        <NotebookSearchBar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          showFavorites={folder === "all" || folder === "daily"}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
          accountId={accountId}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          className={
            mobilePane === "folders" ? "flex h-full min-h-0 w-full md:flex md:w-auto" : "hidden md:flex"
          }
        >
          <NotebookFolders
            folder={folder}
            onSelect={selectFolder}
            collapsed={foldersCollapsed}
            onToggle={toggleFolders}
            customFolders={customFolders}
            accountId={accountId}
          />
        </div>

        <div
          className={
            mobilePane === "list" ? "flex h-full min-h-0 w-full md:flex md:w-auto" : "hidden md:flex"
          }
        >
          <NotebookNoteList
            folder={folder}
            items={listItems}
            selectedDate={showingTrade ? null : selectedDate}
            selectedTradeId={showingTrade ? selectedTradeId : null}
            onSelectItem={selectItem}
            onLogDay={logDay}
            onOpenFolders={() => setMobilePane("folders")}
            loading={loading}
            query={query}
            sort={sort}
            favoritesOnly={favoritesOnly}
            onSortChange={setSort}
            onFavoritesOnlyChange={setFavoritesOnly}
            formatMoney={formatMoney}
            accountId={accountId}
          />
        </div>

        <div
          className={
            mobilePane === "editor"
              ? "flex min-w-0 flex-1 flex-col"
              : "hidden min-w-0 flex-1 md:flex md:flex-col"
          }
        >
          <div className="flex h-11 shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobilePane("list")}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            >
              <ChevronLeft className="h-4 w-4" />
              Notes
            </button>
            <button
              type="button"
              onClick={() => setMobilePane("folders")}
              className="ml-1 inline-flex h-8 items-center rounded-md px-2 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
            >
              Folders
            </button>
          </div>

          {!accountId ? (
            <div className="p-6 text-sm text-[var(--color-text-secondary)]">Select a portfolio to open notes.</div>
          ) : editorEmpty && folder === "trades" ? (
            <EmptyEditor
              title="No trade notes yet"
              hint="Add notes or screenshots on a trade and they will appear here."
            />
          ) : editorEmpty && folder === "favorites" ? (
            <EmptyEditor title="No starred notes" hint="Star a daily journal entry to keep it in My notes." />
          ) : editorEmpty && folder === "all" ? (
            <EmptyEditor title="No notes yet" hint="Write a daily note or add notes on a trade." />
          ) : showRecap ? (
            <NotebookRecapPanel
              accountId={accountId}
              date={selectedDate}
              onDirtyChange={setDirty}
              onToggleFolders={toggleFolders}
            />
          ) : showingTrade && selectedTradeId ? (
            <TradeNotePanel
              key={selectedTradeId}
              tradeId={selectedTradeId}
              locale={locale}
              formatMoney={formatMoney}
              onDirtyChange={setDirty}
              onToggleFolders={toggleFolders}
            />
          ) : showDayEditor ? (
            <DayNoteEditor
              key={`${selectedDate}-${folder}`}
              accountId={accountId}
              variant="page"
              onDirtyChange={setDirty}
              onToggleFolders={toggleFolders}
              folders={customFolders}
              folderId={isCustomFolderId(folder) ? folder : notes.find((n) => n.date.slice(0, 10) === selectedDate)?.folder_id ?? null}
              target={{
                date: selectedDate,
                title: formatNoteTitle(selectedDate, locale),
                pnl: day?.pnl ?? 0,
                trades: day?.trades ?? 0,
                winRate: day?.win_rate ?? 0,
                day,
              }}
              formatMoney={formatMoney}
            />
          ) : (
            <EmptyEditor title="Select a note" hint="Pick an item from the list to open it." />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyEditor({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div>
        <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-1 text-[13px] text-[var(--color-text-tertiary)]">{hint}</p>
      </div>
    </div>
  );
}
