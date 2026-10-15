"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { StrategyForm } from "@/components/backtest/strategy/StrategyForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStrategy } from "@/lib/hooks/useStrategies";

export default function EditStrategyPage() {
  const params = useParams<{ id: string }>();
  const strategy = useStrategy(params.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/backtest" className="text-sm text-muted hover:text-foreground">
        Back to backtesting
      </Link>
      {strategy.isLoading ? (
        <div className="dash-card space-y-3 p-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
        </div>
      ) : null}
      {strategy.isError ? (
        <div className="dash-card px-6 py-10 text-center">
          <p className="text-sm text-negative">This strategy isn’t available.</p>
          <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => strategy.refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      {strategy.data ? <StrategyForm strategyId={strategy.data.id} initial={strategy.data.definition} /> : null}
    </div>
  );
}
