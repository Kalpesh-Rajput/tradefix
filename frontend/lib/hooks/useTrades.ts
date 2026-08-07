"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Trade, TradeInput } from "@/lib/types";

export interface TradeFilters {
  symbol?: string;
  setup_tag?: string;
  emotion_tag?: string;
  status?: string;
  account_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

function buildQuery(filters: TradeFilters): string {
  const params = new URLSearchParams();
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.setup_tag) params.set("setup_tag", filters.setup_tag);
  if (filters.emotion_tag) params.set("emotion_tag", filters.emotion_tag);
  if (filters.status) params.set("status", filters.status);
  if (filters.account_id) params.set("account_id", filters.account_id);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useTrades(filters: TradeFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["trades", filters],
    queryFn: () => api.get<Trade[]>(`/api/trades${buildQuery(filters)}`),
    enabled: options?.enabled ?? true,
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

export function useDeleteTrades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await api.delete<void>(`/api/trades/${id}`);
      }
    },
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

function invalidateTradeQueries(qc: ReturnType<typeof useQueryClient>, tradeId?: string) {
  qc.invalidateQueries({ queryKey: ["trades"] });
  if (tradeId) qc.invalidateQueries({ queryKey: ["trades", tradeId] });
  qc.invalidateQueries({ queryKey: ["analytics"] });
  qc.invalidateQueries({ queryKey: ["calendar"] });
}

export function useUploadTradeScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      onProgress,
    }: {
      id: string;
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const form = new FormData();
      form.append("file", file);
      return api.uploadWithProgress<Trade>(`/api/trades/${id}/screenshots`, form, onProgress);
    },
    onSuccess: (trade) => invalidateTradeQueries(qc, trade.id),
  });
}

export function useDeleteTradeScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      api.delete<Trade>(`/api/trades/${id}/screenshots?url=${encodeURIComponent(url)}`),
    onSuccess: (trade) => invalidateTradeQueries(qc, trade.id),
  });
}

export function useUploadTradeVoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      onProgress,
    }: {
      id: string;
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const form = new FormData();
      form.append("file", file);
      return api.uploadWithProgress<Trade>(`/api/trades/${id}/voice`, form, onProgress);
    },
    onSuccess: (trade) => invalidateTradeQueries(qc, trade.id),
  });
}
