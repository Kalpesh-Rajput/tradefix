"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AgentsWorkspace } from "@/components/agents/AgentsWorkspace";

function AgentsRoute() {
  const params = useSearchParams();
  return <AgentsWorkspace createKey={params.get("create")} initialRunId={params.get("run")} />;
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--color-text-tertiary)]">Opening agents…</div>}>
      <AgentsRoute />
    </Suspense>
  );
}
