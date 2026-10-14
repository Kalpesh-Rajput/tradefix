"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { useDataJob } from "@/lib/hooks/useReplay";

export function PreparingDataPanel({ jobId }: { jobId: string | null }) {
  const job = useDataJob(jobId);
  const progress = job.data?.progress ?? 0;
  const message = job.data?.progress_message || "Preparing market data for this trade.";

  return (
    <div className="flex min-h-[420px] flex-1 flex-col justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">Preparing market data</p>
      <p className="mt-1 max-w-md text-sm text-[var(--color-text-secondary)]">{message}</p>
      <div className="mt-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-[var(--color-border-subtle)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Market data progress">
        <div className="h-full rounded-full bg-[var(--accent-hex)] transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(progress, 8))}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">This page checks again automatically.</p>
      <Skeleton className="mt-8 h-40 max-w-3xl" />
    </div>
  );
}
