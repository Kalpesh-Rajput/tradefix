"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useTimeOffsets } from "@/lib/hooks/useDataStatus";

export function TimeOffsetsReport() {
  const offsets = useTimeOffsets();
  return (
    <section className="dash-card overflow-x-auto">
      <h2 className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Time offsets</h2>
      {offsets.isLoading ? <Skeleton className="m-4 h-16" /> : null}
      {offsets.isError ? <p className="px-4 py-3 text-sm text-negative">Couldn’t load the time-offset report.</p> : null}
      {(offsets.data ?? []).length === 0 && !offsets.isLoading ? <p className="px-4 py-3 text-sm text-muted">No account offsets yet.</p> : null}
      {(offsets.data ?? []).length ? (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-2 py-2 font-medium">User</th>
              <th className="px-2 py-2 font-medium">Zone</th>
              <th className="px-2 py-2 font-medium">Confidence</th>
              <th className="px-2 py-2 font-medium">Match</th>
              <th className="px-2 py-2 font-medium">Sample</th>
            </tr>
          </thead>
          <tbody>
            {(offsets.data ?? []).map((row) => (
              <tr key={row.account_id} className="border-t border-border/60">
                <td className="px-4 py-2">{row.account_name}</td>
                <td className="px-2 py-2 text-muted">{row.user_email}</td>
                <td className="px-2 py-2">{row.tz_value}</td>
                <td className="px-2 py-2">{row.confidence}</td>
                <td className="px-2 py-2 font-mono">{(row.match_rate * 100).toFixed(0)}%</td>
                <td className="px-2 py-2 font-mono">{row.sample_size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
