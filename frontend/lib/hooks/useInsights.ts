"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Insight } from "@/lib/types";

export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: () => api.get<Insight[]>("/api/insights"),
  });
}

export function useGenerateInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<Insight[]>("/api/insights/generate"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Insight>(`/api/insights/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
}
