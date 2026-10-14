"use client";

import { useQuery } from "@tanstack/react-query";

import { ApiError, api } from "@/lib/api";
import type { DataJob, ReplayPayload } from "@/lib/backtest/marketClient";

function retryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterS) return error.retryAfterS * 1000;
  return Math.min(1000 * 2 ** attempt, 15_000);
}

function retryReplay(count: number, error: unknown): boolean {
  if (!(error instanceof ApiError) || count >= 3) return false;
  return error.code === "rate_limited" || error.code === "network" || error.status === 0 || error.status >= 500;
}

export function useReplay(tradeId: string) {
  return useQuery({
    queryKey: ["replay", tradeId],
    queryFn: () => api.get<ReplayPayload>(`/api/trades/${tradeId}/replay`),
    enabled: tradeId.length > 0,
    retry: retryReplay,
    retryDelay,
    refetchInterval: (query) => (query.state.data?.status === "preparing" ? 2_000 : false),
  });
}

export function useDataJob(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ["market-data-job", jobId],
    queryFn: () => api.get<DataJob>(`/api/market-data/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "succeeded" || status === "failed" || status === "cancelled" ? false : 2_000;
    },
  });
}
