"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type RunBreakdowns = {
  weekday_pnl: number[];
  hour_pnl: number[];
  monthly: { month: string; change: number }[];
  r_histogram: number[];
  drawdown: { t: number; v: number }[];
};

export type RunMetrics = {
  net_profit?: number;
  return_pct?: number;
  trade_count?: number;
  win_rate?: number;
  profit_factor?: number | null;
  expectancy_r?: number | null;
  average_r?: number | null;
  max_drawdown?: number;
  max_drawdown_pct?: number;
  breakdowns?: RunBreakdowns;
};

export type BacktestRun = {
  id: string;
  name: string;
  strategy_id: string | null;
  symbol: string;
  timeframe: string;
  status: "queued" | "running" | "waiting_data" | "succeeded" | "failed" | "cancelled";
  error_code: string | null;
  start_ms: number;
  end_ms: number;
  metrics: RunMetrics | null;
  equity: { t: number; v: number }[] | null;
  warnings: string[];
  error_message: string | null;
  bars_processed: number;
  served_from_cache: boolean;
  waiting_since?: string | null;
  job_id: string | null;
  progress: number;
  progress_message: string | null;
};

export type RunTrade = {
  seq: number;
  side: string;
  size: number;
  entry_ms: number;
  entry_price: number;
  exit_ms: number;
  exit_price: number;
  pnl: number;
  pips: number;
  r_multiple: number | null;
  exit_reason: string;
  bars_held: number;
};

const KEY = ["backtest-runs"] as const;

export function useBacktestRuns() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<BacktestRun[]>("/api/backtests"),
  });
}

export function useBacktestRun(id: string) {
  return useQuery({
    queryKey: ["backtest-run", id],
    queryFn: () => api.get<BacktestRun>(`/api/backtests/${id}`),
    enabled: id.length > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" || status === "waiting_data" ? 2000 : false;
    },
  });
}

export function useRunTrades(id: string, filters: { side?: string; exit_reason?: string }) {
  const params = new URLSearchParams({ limit: "200", offset: "0" });
  if (filters.side) params.set("side", filters.side);
  if (filters.exit_reason) params.set("exit_reason", filters.exit_reason);
  return useQuery({
    queryKey: ["backtest-run-trades", id, filters.side ?? "", filters.exit_reason ?? ""],
    queryFn: () => api.get<{ total: number; trades: RunTrade[] }>(`/api/backtests/${id}/trades?${params}`),
    enabled: id.length > 0,
  });
}

export function useCancelRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<BacktestRun>(`/api/backtests/${id}/cancel`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["backtest-run", id] });
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/backtests/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
