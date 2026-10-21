"use client";

import { ArrowRight, Layers, Plus } from "lucide-react";
import Link from "next/link";

import { HubEmpty } from "@/components/backtest/hub/HubEmpty";
import { HubPanel } from "@/components/backtest/hub/HubPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { pairLabel } from "@/lib/backtest/hubStats";
import { useStrategies } from "@/lib/hooks/useStrategies";

const NEW_STRATEGY =
  "dash-btn-primary text-on-accent inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.7)]";

export function StrategiesList() {
  const strategies = useStrategies();

  if (strategies.isLoading) {
    return (
      <HubPanel title="Strategies">
        <div className="space-y-3 p-5">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </HubPanel>
    );
  }
  if (strategies.isError) {
    return (
      <div className="dash-card px-6 py-10 text-center">
        <p className="text-sm text-negative">Couldn’t load strategies.</p>
        <button type="button" className="mt-2 text-sm font-medium text-primary hover:underline" onClick={() => strategies.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  const rows = strategies.data ?? [];
  const create = (
    <Link href="/backtest/strategies/new" className={NEW_STRATEGY}>
      <Plus className="h-4 w-4" aria-hidden />
      New strategy
    </Link>
  );

  if (rows.length === 0) {
    return (
      <HubEmpty
        icon={Layers}
        title="Build your first strategy"
        body="Start from a template or from scratch. Templates open on EUR/USD, 2 March–1 April 2026, and saved strategies can be run again."
        action={create}
      />
    );
  }

  return (
    <HubPanel title="Strategies" subtitle={`${rows.length} saved`} action={create}>
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-primary/[0.035]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                <Layers className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">{row.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {row.definition.market?.symbol ? pairLabel(row.definition.market.symbol) : "—"} · {row.definition.market?.timeframe}
                </p>
              </div>
            </div>
            <Link
              href={`/backtest/strategies/${row.id}`}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
            >
              Edit
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </HubPanel>
  );
}
