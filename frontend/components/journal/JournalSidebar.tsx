"use client";

import clsx from "clsx";
import { BookOpen, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DailyRecap } from "@/lib/types";

export type JournalListItem = {
  date: string;
  label: string;
  subtitle: string;
  recap: DailyRecap | null;
  isToday: boolean;
};

export function JournalSidebar({
  items,
  selectedDate,
  onSelect,
  onAddToday,
  loading,
  entryCount,
}: {
  items: JournalListItem[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onAddToday: () => void;
  loading?: boolean;
  entryCount: number;
}) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.06] bg-zinc-950/80 md:w-[280px] md:shrink-0">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">
            Journal
          </h1>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </p>
        </div>
        <Button size="sm" onClick={onAddToday} className="shrink-0 !px-2.5">
          <Plus className="h-3.5 w-3.5" />
          Add Recap
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BookOpen className="h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">No entries yet</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const active = item.date === selectedDate;
              return (
                <li key={item.date}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.date)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left transition",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-300 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight">{item.label}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{item.subtitle}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
