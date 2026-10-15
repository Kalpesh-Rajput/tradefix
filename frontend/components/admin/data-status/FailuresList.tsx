"use client";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useRetryJob, type FailedJob } from "@/lib/hooks/useDataStatus";

export function FailuresList({ rows }: { rows: FailedJob[] }) {
  const retry = useRetryJob();
  const toast = useToast();

  return (
    <section className="dash-card p-4">
      <h2 className="text-sm font-medium text-foreground">Failed jobs</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">No failed jobs.</p> : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-foreground">{job.type}</p>
                <p className="text-xs text-negative">{job.error_code}: {job.error_message}</p>
              </div>
              <button
                type="button"
                className="dash-btn-secondary h-9 px-3 text-sm"
                disabled={retry.isPending}
                onClick={() => {
                  retry.mutate(job.id, {
                    onSuccess: () => toast.success("Job queued again"),
                    onError: (error) => toast.error("Couldn’t retry", error instanceof ApiError ? error.message : "Try again."),
                  });
                }}
              >
                Retry
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
