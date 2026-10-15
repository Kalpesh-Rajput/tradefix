"use client";

import Link from "next/link";

import { Skeleton } from "@/components/ui/Skeleton";
import { useStrategies } from "@/lib/hooks/useStrategies";

export function StrategiesList() {
  const strategies = useStrategies();

  if (strategies.isLoading) {
    return (
      <div className="dash-card space-y-3 p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (strategies.isError) {
    return (
      <div className="dash-card px-6 py-10 text-center">
        <p className="text-sm text-negative">Couldn’t load strategies.</p>
        <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => strategies.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  const rows = strategies.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{rows.length === 0 ? "No strategies yet" : `${rows.length} saved`}</p>
        <Link href="/backtest/strategies/new" className="dash-btn-primary inline-flex h-10 items-center px-3 text-sm">
          New strategy
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="dash-card px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">Build a strategy from a template or from scratch.</p>
          <p className="mt-1 text-sm text-muted">Saved strategies stay here and can be run again.</p>
        </div>
      ) : (
        <ul className="dash-card divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{row.name}</p>
                <p className="text-xs text-muted">{row.definition.market?.symbol} · {row.definition.market?.timeframe}</p>
              </div>
              <Link href={`/backtest/strategies/${row.id}`} className="text-sm text-primary hover:underline">
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
