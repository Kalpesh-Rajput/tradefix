"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { MasterCategory, PrecheckList, TradeMaster } from "@/lib/types";

export function useMasters(category?: MasterCategory, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["masters", category ?? "all"],
    queryFn: () => {
      const qs = category ? `?category=${category}` : "";
      return api.get<TradeMaster[]>(`/api/masters${qs}`);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCreateMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category: MasterCategory; name: string }) =>
      api.post<TradeMaster>("/api/masters", data),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["masters"] });
      qc.invalidateQueries({ queryKey: ["masters", row.category] });
    },
  });
}

export function useDeleteMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/masters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["masters"] }),
  });
}

export function usePrecheckLists(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["precheck-lists"],
    queryFn: () => api.get<PrecheckList[]>("/api/precheck-lists"),
    enabled: options?.enabled ?? true,
  });
}

export function useCreatePrecheckList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; items: { label: string }[] }) =>
      api.post<PrecheckList>("/api/precheck-lists", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["precheck-lists"] }),
  });
}

export function useUpdatePrecheckList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; items?: { id?: string; label: string }[] } }) =>
      api.patch<PrecheckList>(`/api/precheck-lists/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["precheck-lists"] }),
  });
}

export function useDeletePrecheckList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/precheck-lists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["precheck-lists"] }),
  });
}
