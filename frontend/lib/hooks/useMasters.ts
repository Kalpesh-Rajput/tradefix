"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { masterCategoryLabel } from "@/lib/masters";
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

export function useEnsureMaster(category: MasterCategory) {
  const createMaster = useCreateMaster();
  const toast = useToast();

  const ensure = useCallback(
    async (raw: string, options?: { uppercase?: boolean; known?: string[] }) => {
      const cleaned = raw.trim().replace(/\s+/g, " ");
      const name = options?.uppercase ? cleaned.toUpperCase() : cleaned;
      if (!name) return null;
      if (name.length > 100) {
        toast.error("Name is too long", "Use 100 characters or fewer.");
        return null;
      }
      const existed = (options?.known ?? []).some((item) => item.toLowerCase() === name.toLowerCase());
      try {
        const row = await createMaster.mutateAsync({ category, name });
        if (!existed) toast.success(`Added to ${masterCategoryLabel(category)}`, row.name);
        return row.name;
      } catch (err) {
        toast.error("Couldn’t save to masters", err instanceof Error ? err.message : "Try again.");
        return null;
      }
    },
    [category, createMaster, toast]
  );

  return { ensure, pending: createMaster.isPending };
}

export function useUpdateMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; sort_order?: number; is_active?: boolean } }) =>
      api.patch<TradeMaster>(`/api/masters/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["masters"] }),
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
