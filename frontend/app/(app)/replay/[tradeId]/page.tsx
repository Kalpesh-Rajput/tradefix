"use client";

import { useParams } from "next/navigation";

import { ReplayHeader } from "@/components/replay/ReplayHeader";
import { PreparingDataPanel } from "@/components/replay/PreparingDataPanel";
import { ReplaySkeleton, ReplayStates } from "@/components/replay/ReplayStates";
import { ReplayStage } from "@/components/replay/ReplayStage";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api";
import { useReplay } from "@/lib/hooks/useReplay";

export default function ReplayPage() {
  const params = useParams<{ tradeId: string }>();
  const tradeId = params.tradeId ?? "";
  const { user } = useAuth();
  const replay = useReplay(tradeId);
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
      {replay.data.status === "preparing" ? (
        <PreparingDataPanel jobId={replay.data.job_id} />
      ) : (
        <ReplayStage payload={replay.data} timeZone={timeZone} />
      )}
    </div>
  );
}
