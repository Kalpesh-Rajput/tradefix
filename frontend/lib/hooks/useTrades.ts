"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Trade, TradeInput } from "@/lib/types";

export interface TradeFilters {
  symbol?: string;
  setup_tag?: string;
  status?: string;
}

function buildQuery(filters: TradeFilters): string {
  const params = new URLSearchParams();
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.setup_tag) params.set("setup_tag", filters.setup_tag);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTrades(filters: TradeFilters = {}) {
  return useQuery({
    queryKey: ["trades", filters],
    queryFn: () => api.get<Trade[]>(`/api/trades${buildQuery(filters)}`),
  });
}

export function useTrade(id: string | undefined) {
  return useQuery({
    queryKey: ["trades", id],
    queryFn: () => api.get<Trade>(`/api/trades/${id}`),
    enabled: !!id,
  });
}

export function useCreateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TradeInput) => api.post<Trade>("/api/trades", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TradeInput> }) =>
      api.patch<Trade>(`/api/trades/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/trades/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api.postForm<{ imported: number; skipped_duplicates: number; errors: string[] }>(
        "/api/imports/csv",
        form
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
