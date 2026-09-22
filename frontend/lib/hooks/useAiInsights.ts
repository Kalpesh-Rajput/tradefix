"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AiInsightsFeed } from "@/lib/types";

export function aiInsightsQueryKey(accountId?: string | null) {
  return ["ai-insights", accountId ?? "all"] as const;
}

export function useAiInsights(accountId?: string | null, options?: { enabled?: boolean }) {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  const qs = params.toString();
  return useQuery({
    queryKey: aiInsightsQueryKey(accountId),
    queryFn: () => api.get<AiInsightsFeed>(`/api/ai/insights${qs ? `?${qs}` : ""}`),
    enabled: options?.enabled ?? true,
  });
}

export function useRefreshAiInsights(accountId?: string | null) {
  const qc = useQueryClient();
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  const qs = params.toString();
  return useMutation({
    mutationFn: () => api.post<AiInsightsFeed>(`/api/ai/insights/refresh${qs ? `?${qs}` : ""}`),
    onSuccess: (data) => {
      qc.setQueryData(aiInsightsQueryKey(accountId), data);
    },
  });
}

export function useAppendManualRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; schedule?: string[] }) =>
      api.post("/api/progress-tracker/manual-rules", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress-tracker"] });
    },
  });
}
