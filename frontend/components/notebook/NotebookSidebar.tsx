"use client";

import clsx from "clsx";
import { BookOpen, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";

export type NotebookTab = "daily" | "trades";

export type DailyListItem = {
  id: string;
  date: string;
  title: string;
  favorite: boolean;
  shots: number;
};

export type TradeListItem = {
  id: string;
  title: string;
  subtitle: string;
  pnl: number;
  shots: number;
  hasNote: boolean;
};

export function NotebookSidebar({
  tab,
  onTabChange,
  dailyItems,
  tradeItems,
  selectedDate,
  selectedTradeId,
  onSelectDate,
  onSelectTrade,
  loading,
  formatMoney,
}: {
  tab: NotebookTab;
  onTabChange: (tab: NotebookTab) => void;
  dailyItems: DailyListItem[];
  tradeItems: TradeListItem[];
  selectedDate: string | null;
  selectedTradeId: string | null;
  onSelectDate: (date: string) => void;
  onSelectTrade: (id: string) => void;
  loading?: boolean;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const days = useMemo(
    () => dailyItems.filter((item) => !q || item.title.toLowerCase().includes(q) || item.date.includes(q)),
    [dailyItems, q]
  );
  const trades = useMemo(
    () =>
      tradeItems.filter(
        (item) => !q || item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
      ),
    [tradeItems, q]
  );

  const count = tab === "daily" ? days.length : trades.length;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:w-[240px] md:shrink-0">
      <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-3">
        <h1 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Notebook</h1>
        <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
          {count} {tab === "daily" ? (count === 1 ? "day" : "days") : count === 1 ? "trade" : "trades"}
        </p>
        <div className="mt-3 grid h-11 grid-cols-2 gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-0.5">
          <button
            type="button"
            onClick={() => onTabChange("daily")}
            className={clsx(
              "rounded h-full text-[12px] font-medium",
              tab === "daily"
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => onTabChange("trades")}
            className={clsx(
              "rounded h-full text-[12px] font-medium",
              tab === "trades"
                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]"
                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            Trades
          </button>
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "daily" ? "Search days" : "Search trades"}
            className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-2 text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-1">
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
            <Skeleton className="h-12 rounded-md" />
          </div>
        ) : tab === "daily" ? (
          days.length === 0 ? (
            <Empty
              title={q ? "No matching days" : "No daily notes yet"}
              hint={q ? "Try a different search." : "Write a note here or open a day in Day View."}
            />
          ) : (
            days.map((item) => {
              const active = item.date === selectedDate;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectDate(item.date)}
                  className={clsx(
                    "mb-1 w-full rounded-md px-2.5 py-2 text-left",
                    active
                      ? "bg-[var(--color-primary-light)] text-primary"
                      : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 truncate text-[12px] font-medium">{item.title}</p>
                    {item.favorite ? <Star className="h-3 w-3 shrink-0 fill-current text-[#F3C623]" /> : null}
                  </div>
                  <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                    {item.shots ? `${item.shots} screenshot${item.shots === 1 ? "" : "s"}` : "No screenshots"}
                  </p>
                </button>
              );
            })
          )
        ) : trades.length === 0 ? (
          <Empty
            title={q ? "No matching trades" : "No trade notes yet"}
            hint={q ? "Try a different search." : "Notes and screenshots from your trades show up here."}
          />
        ) : (
          trades.map((item) => {
            const active = item.id === selectedTradeId;
            const pnl = Number(item.pnl);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTrade(item.id)}
                className={clsx(
                  "mb-1 w-full rounded-md px-2.5 py-2 text-left",
                  active
                    ? "bg-[var(--color-primary-light)] text-primary"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[12px] font-medium">{item.title}</p>
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums"
                    style={{ color: pnl >= 0 ? "#2F9E6A" : "#E35D68" }}
                  >
                    {formatMoney(pnl, { signed: true, digits: 2 })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-tertiary)]">
                  {item.subtitle}
                  {item.shots ? ` · ${item.shots} shot${item.shots === 1 ? "" : "s"}` : ""}
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-10 text-center">
      <BookOpen className="h-7 w-7 text-[var(--color-text-muted)]" />
      <p className="mt-2 text-[12px] font-medium text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{hint}</p>
    </div>
  );
}
