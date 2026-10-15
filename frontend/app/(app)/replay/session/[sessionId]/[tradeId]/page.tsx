"use client";

import { useParams } from "next/navigation";

import { SimulatedReplayLoader } from "@/components/replay/SimulatedReplayLoader";

export default function SessionReplayPage() {
  const params = useParams<{ sessionId: string; tradeId: string }>();
  return <SimulatedReplayLoader sessionId={params.sessionId ?? ""} tradeId={params.tradeId ?? ""} />;
}
