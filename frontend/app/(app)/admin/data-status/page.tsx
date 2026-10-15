"use client";

import { AliasesPanel } from "@/components/admin/data-status/AliasesPanel";
import { BackfillForm } from "@/components/admin/data-status/BackfillForm";
import { CoverageTable } from "@/components/admin/data-status/CoverageTable";
import { FailuresList } from "@/components/admin/data-status/FailuresList";
import { TimeOffsetsReport } from "@/components/admin/data-status/TimeOffsetsReport";
import { UnresolvedList } from "@/components/admin/data-status/UnresolvedList";
import { useAuth } from "@/components/providers/AuthProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDataStatus } from "@/lib/hooks/useDataStatus";

export default function DataStatusPage() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const status = useDataStatus(!loading && isAdmin);
  const forbidden = !loading && !isAdmin;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Market data</h1>
        <p className="mt-1 text-sm text-muted">Coverage, failed fetches, aliases and detected account time zones.</p>
      </div>
      {loading ? <Skeleton className="h-24" /> : null}
      {forbidden ? <p className="dash-card px-6 py-10 text-center text-sm text-muted">Admin access is required for this page.</p> : null}
      {!forbidden && status.isLoading ? (
        <div className="dash-card space-y-3 p-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
        </div>
      ) : null}
      {!forbidden && status.isError ? (
        <div className="dash-card px-6 py-10 text-center">
          <p className="text-sm text-negative">Couldn’t load data status.</p>
          <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => status.refetch()}>Retry</button>
        </div>
      ) : null}
      {!forbidden && status.data ? (
        <>
          <CoverageTable rows={status.data.instruments} />
          <FailuresList rows={status.data.failures} />
          <BackfillForm instruments={status.data.instruments} />
          <AliasesPanel />
          <UnresolvedList />
          <TimeOffsetsReport />
        </>
      ) : null}
    </div>
  );
}
