"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DailyRecap, DailyRecapInput, DayPnlSummary } from "@/lib/types";

export function useRecaps(accountId: string | undefined) {
  return useQuery({
    queryKey: ["recaps", accountId],
    queryFn: () => api.get<DailyRecap[]>(`/api/recaps?account_id=${accountId}`),
    enabled: !!accountId,
  });
}

export function useDayPnl(accountId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ["recaps", "day-pnl", accountId, date],
    queryFn: () =>
      api.get<DayPnlSummary>(`/api/recaps/day-pnl?account_id=${accountId}&date=${date}`),
    enabled: !!accountId && !!date,
  });
}

export function useUpsertRecap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DailyRecapInput) => api.post<DailyRecap>("/api/recaps", data),
    onSuccess: (recap) => {
      qc.invalidateQueries({ queryKey: ["recaps", recap.account_id] });
      qc.invalidateQueries({ queryKey: ["recaps", "day-pnl"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useDeleteRecap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      api.delete<void>(`/api/recaps/${id}`).then(() => ({ id, accountId })),
    onSuccess: ({ accountId }) => {
      qc.invalidateQueries({ queryKey: ["recaps", accountId] });
      qc.invalidateQueries({ queryKey: ["recaps", "day-pnl"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUploadRecapScreenshot() {
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
      return api.uploadWithProgress<DailyRecap>(`/api/recaps/${id}/screenshots`, form, onProgress);
    },
    onSuccess: (recap) => {
      qc.invalidateQueries({ queryKey: ["recaps", recap.account_id] });
    },
  });
}

export function useDeleteRecapScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      api.delete<DailyRecap>(`/api/recaps/${id}/screenshots?url=${encodeURIComponent(url)}`),
    onSuccess: (recap) => {
      qc.invalidateQueries({ queryKey: ["recaps", recap.account_id] });
    },
  });
}
