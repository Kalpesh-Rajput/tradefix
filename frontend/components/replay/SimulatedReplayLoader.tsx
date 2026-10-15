"use client";

import { useQuery } from "@tanstack/react-query";

import { ReplayHeader } from "@/components/replay/ReplayHeader";
import { PreparingDataPanel } from "@/components/replay/PreparingDataPanel";
import { ReplaySkeleton, ReplayStates } from "@/components/replay/ReplayStates";
import { ReplayStage } from "@/components/replay/ReplayStage";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError, api } from "@/lib/api";
import type { ReplayPayload } from "@/lib/backtest/marketClient";

function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterS) return error.retryAfterS * 1000;
  return Math.min(1000 * 2 ** attempt, 15_000);
}

export function SimulatedReplayLoader({ sessionId, tradeId }: { sessionId: string; tradeId: string }) {
  const { user } = useAuth();
  const replay = useQuery({
    queryKey: ["session-replay", sessionId, tradeId],
    queryFn: () => api.get<ReplayPayload>(`/api/backtest/sessions/${sessionId}/trades/${tradeId}/replay`),
    enabled: sessionId.length > 0 && tradeId.length > 0,
    retry: (count, error) => {
      if (!(error instanceof ApiError) || count >= 3) return false;
      return error.code === "rate_limited" || error.code === "network" || error.status === 0 || error.status >= 500;
    },
    retryDelay,
    refetchInterval: (query) => (query.state.data?.status === "preparing" ? 2_000 : false),
  });
  const timeZone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  if (replay.isLoading) return <ReplaySkeleton />;
  if (replay.error) {
    const error = replay.error instanceof ApiError ? replay.error : new ApiError("Replay could not be loaded.", 0, { code: "network" });
    return <ReplayStates error={error} onRetry={() => void replay.refetch()} />;
  }
  if (!replay.data) return <ReplaySkeleton />;

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-3">
      <ReplayHeader payload={replay.data} timeZone={timeZone} />
      {replay.data.status === "preparing" ? <PreparingDataPanel jobId={replay.data.job_id} /> : <ReplayStage payload={replay.data} timeZone={timeZone} />}
    </div>
  );
}
