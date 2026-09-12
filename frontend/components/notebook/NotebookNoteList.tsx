"use client";

import clsx from "clsx";
import { BookOpen, Filter, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LogDayButton } from "@/components/notebook/LogDayButton";
import { folderShowsLogDay, isCustomFolderId, type NotebookFolderId, type NotebookListItem, type NotebookSort } from "@/components/notebook/types";
import { Skeleton } from "@/components/ui/Skeleton";

export function NotebookNoteList({
  folder,
  items,
  selectedDate,
  selectedTradeId,
  onSelectItem,
  onLogDay,
  onOpenFolders,
  loading,
  query,
  sort,
  favoritesOnly,
  onSortChange,
  onFavoritesOnlyChange,
  formatMoney,
  accountId,
}: {
  folder: NotebookFolderId;
  items: NotebookListItem[];
  selectedDate: string | null;
  selectedTradeId: string | null;
  onSelectItem: (item: NotebookListItem) => void;
  onLogDay: (date: string) => void;
  onOpenFolders?: () => void;
  loading?: boolean;
  query: string;
  sort: NotebookSort;
  favoritesOnly: boolean;
  onSortChange: (sort: NotebookSort) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  accountId?: string;
}) {
  const empty = emptyCopy(folder, Boolean(query.trim()));

  return (
    <section className="flex h-full min-h-0 w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:w-[260px] md:shrink-0">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-2.5">
        <div className="flex min-w-0 items-center gap-1">
          {onOpenFolders ? (
            <button
              type="button"
              onClick={onOpenFolders}
              className="inline-flex h-8 items-center rounded-md px-2 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] md:hidden"
            >
              Folders
            </button>
          ) : null}
          {folderShowsLogDay(folder) ? (
            <LogDayButton accountId={accountId} onSelect={onLogDay} />
          ) : (
            <span className="text-[12px] font-medium text-[var(--color-text-tertiary)]">Trade notes</span>
          )}
        </div>
        <FilterMenu
          sort={sort}
          favoritesOnly={favoritesOnly}
          onSortChange={onSortChange}
          onFavoritesOnlyChange={onFavoritesOnlyChange}
          showFavorites={folder === "all" || folder === "daily"}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-1">
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
            <Skeleton className="h-14 rounded-md" />
          </div>
        ) : items.length === 0 ? (
          <Empty title={empty.title} hint={empty.hint} />
        ) : (
          items.map((item) => {
            const active =
              item.kind === "trade" ? item.id === selectedTradeId : item.date === selectedDate;
            return (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => onSelectItem(item)}
                className={clsx(
                  "mb-1 w-full rounded-lg border px-3 py-2.5 text-left",
                  active
                    ? "border-primary/20 bg-[var(--color-primary-light)] text-primary"
                    : "border-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
                )}
              >
                {item.kind === "trade" ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[12px] font-medium">{item.title}</p>
                      <span
                        className="shrink-0 text-[11px] font-semibold tabular-nums"
                        style={{ color: item.pnl >= 0 ? "#2F9E6A" : "#E35D68" }}
                      >
                        {formatMoney(item.pnl, { signed: true, digits: 2 })}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-tertiary)]">
                      {item.subtitle}
                      {item.shots ? ` · ${item.shots} shot${item.shots === 1 ? "" : "s"}` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 truncate text-[12px] font-medium">{item.title}</p>
                      {item.kind === "day" && item.favorite ? (
                        <Star className="h-3 w-3 shrink-0 fill-current text-[#F3C623]" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-tertiary)]">{item.numericDate}</p>
                  </>
                )}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function FilterMenu({
  sort,
  favoritesOnly,
  onSortChange,
  onFavoritesOnlyChange,
  showFavorites,
}: {
  sort: NotebookSort;
  favoritesOnly: boolean;
  onSortChange: (sort: NotebookSort) => void;
  onFavoritesOnlyChange: (value: boolean) => void;
  showFavorites: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
        aria-label="Sort and filter"
        aria-expanded={open}
      >
        <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]">
          <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Sort
          </p>
          <button
            type="button"
            onClick={() => {
              onSortChange("newest");
              setOpen(false);
            }}
            className={clsx(
              "block w-full px-3 py-1.5 text-left text-[12px]",
              sort === "newest"
                ? "bg-[var(--color-primary-light)] text-primary"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            )}
          >
            Newest first
          </button>
          <button
            type="button"
            onClick={() => {
              onSortChange("oldest");
              setOpen(false);
            }}
            className={clsx(
              "block w-full px-3 py-1.5 text-left text-[12px]",
              sort === "oldest"
                ? "bg-[var(--color-primary-light)] text-primary"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
            )}
          >
            Oldest first
          </button>
          {showFavorites ? (
            <>
              <div className="my-1 h-px bg-[var(--color-border)]" />
              <button
                type="button"
                onClick={() => {
                  onFavoritesOnlyChange(!favoritesOnly);
                  setOpen(false);
                }}
                className={clsx(
                  "block w-full px-3 py-1.5 text-left text-[12px]",
                  favoritesOnly
                    ? "bg-[var(--color-primary-light)] text-primary"
                    : "text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
                )}
              >
                {favoritesOnly ? "All notes" : "Favorites only"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
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

function emptyCopy(folder: NotebookFolderId, searching: boolean) {
  if (searching) return { title: "No matching notes", hint: "Try a different search or date range." };
  if (folder === "trades") {
    return { title: "No trade notes yet", hint: "Notes and screenshots from your trades show up here." };
  }
  if (folder === "recaps") {
    return { title: "No session recaps yet", hint: "Use Log day to open a recap for a specific date." };
  }
  if (folder === "favorites") {
    return { title: "No starred notes", hint: "Star a daily journal entry to keep it here." };
  }
  if (folder === "all") {
    return { title: "No notes yet", hint: "Write a daily note or add notes on a trade." };
  }
  if (isCustomFolderId(folder)) {
    return { title: "This folder is empty", hint: "Use Log day to add a note, or move an existing note here." };
  }
  return { title: "No daily notes yet", hint: "Use Log day to open a date, then save your note." };
}
