"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { MarketInstrument, SessionCreateInput, SessionSummary } from "@/lib/backtest/sessions";

const SESSIONS_KEY = ["backtest-sessions"] as const;

export function useBacktestSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => api.get<SessionSummary[]>("/api/backtest/sessions"),
  });
}

export function useMarketInstruments() {
  return useQuery({
    queryKey: ["market-instruments"],
    queryFn: () => api.get<MarketInstrument[]>("/api/market-data/instruments"),
    staleTime: 60_000,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SessionCreateInput) => api.post<SessionSummary>("/api/backtest/sessions", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/backtest/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export function useRenameSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cursorMs, notes }: { id: string; cursorMs: number; notes: string }) =>
      api.put(`/api/backtest/sessions/${id}/state`, { cursor_ms: cursorMs, notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}
