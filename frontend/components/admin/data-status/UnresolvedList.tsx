"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useUnresolved } from "@/lib/hooks/useDataStatus";

export function UnresolvedList() {
  const unresolved = useUnresolved();
  return (
    <section className="dash-card p-4">
      <h2 className="text-sm font-medium text-foreground">Unresolved symbols</h2>
      {unresolved.isLoading ? <Skeleton className="mt-3 h-16" /> : null}
      {unresolved.isError ? <p className="mt-2 text-sm text-negative">Couldn’t load unresolved symbols.</p> : null}
      {(unresolved.data ?? []).length === 0 && !unresolved.isLoading ? <p className="mt-2 text-sm text-muted">None recorded.</p> : null}
      <ul className="mt-2 divide-y divide-border">
        {(unresolved.data ?? []).map((row) => (
          <li key={row.id} className="flex justify-between py-2 text-sm">
            <span>{row.broker} · {row.raw_symbol}</span>
            <span className="text-muted">{row.count} seen · {row.interest_count} interest</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
