"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { StrategyDefinition } from "@/lib/backtest/strategyForm";

export type StrategyRecord = {
  id: string;
  name: string;
  description: string;
  schema_version: number;
  definition: StrategyDefinition;
  created_at: string | null;
  updated_at: string | null;
};

export type StrategyValidation = {
  ok: boolean;
  errors: { field: string; message: string }[];
  estimated_bars: number | null;
};

const KEY = ["strategies"] as const;

export function useStrategies() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<StrategyRecord[]>("/api/strategies"),
  });
}

export function useStrategy(id: string) {
  return useQuery({
    queryKey: ["strategy", id],
    queryFn: () => api.get<StrategyRecord>(`/api/strategies/${id}`),
    enabled: id.length > 0,
  });
}

export function useCreateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (definition: StrategyDefinition) => api.post<StrategyRecord>("/api/strategies", definition),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, definition }: { id: string; definition: StrategyDefinition }) =>
      api.put<StrategyRecord>(`/api/strategies/${id}`, definition),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["strategy", variables.id] });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/strategies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
