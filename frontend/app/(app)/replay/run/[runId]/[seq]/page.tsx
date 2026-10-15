"use client";

import { useParams } from "next/navigation";

import { SimulatedReplayLoader } from "@/components/replay/SimulatedReplayLoader";

export default function RunReplayPage() {
  const params = useParams<{ runId: string; seq: string }>();
  const runId = params.runId ?? "";
  const seq = params.seq ?? "";
  return <SimulatedReplayLoader replayPath={`/api/backtests/${runId}/trades/${seq}/replay`} />;
}
