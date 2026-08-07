"use client";

import { Check, Trophy } from "lucide-react";
import clsx from "clsx";

import { Skeleton } from "@/components/ui/Skeleton";
import { useMilestones } from "@/lib/hooks/useCheckins";

export function MilestonesStrip() {
  const { data, isLoading, isError } = useMilestones();

  if (isLoading) {
    return <Skeleton className="h-24 rounded-xl" />;
  }

  if (isError || !data) {
    return null;
  }

  const items = data.items;
  const unlocked = data.unlocked_count;

  return (
    <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-white">Milestones</h3>
        </div>
        <span className="text-xs text-zinc-500">
          {unlocked}/{items.length} unlocked
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => {
          const pct = item.target > 0 ? Math.round((item.progress / item.target) * 100) : 0;
          return (
            <div
              key={item.id}
              title={item.description}
              className={clsx(
                "min-w-[140px] shrink-0 rounded-lg border px-3 py-2.5",
                item.unlocked
                  ? "border-primary/30 bg-primary/5"
                  : "border-white/[0.08] bg-zinc-900/60"
              )}
            >
              <div className="flex items-center gap-1.5">
                {item.unlocked ? (
                  <Check className="h-3 w-3 text-primary" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-white/20" />
                )}
                <p
                  className={clsx(
                    "truncate text-xs font-medium",
                    item.unlocked ? "text-primary" : "text-zinc-300"
                  )}
                >
                  {item.label}
                </p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={clsx("h-full rounded-full", item.unlocked ? "bg-primary" : "bg-zinc-600")}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[10px] text-zinc-500">
                {item.progress}/{item.target}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
