"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AiInsightsFeed } from "@/lib/types";

export type InsightWindow = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

export type InsightFilterParams = {
  setup?: string;
  symbol?: string;
  session?: string;
  side?: string;
  playbookId?: string;
};

export function compactInsightFilters(filters?: InsightFilterParams): InsightFilterParams {
  if (!filters) return {};
  const next: InsightFilterParams = {};
  if (filters.setup) next.setup = filters.setup;
  if (filters.symbol) next.symbol = filters.symbol;
  if (filters.session) next.session = filters.session;
  if (filters.side) next.side = filters.side;
  if (filters.playbookId) next.playbookId = filters.playbookId;
  return next;
}

export function aiInsightsQueryKey(
  accountId?: string | null,
  window: InsightWindow = "30d",
  filters?: InsightFilterParams
) {
  return ["ai-insights", accountId ?? "all", window, compactInsightFilters(filters)] as const;
}

function insightsQuery(accountId: string | null | undefined, window: InsightWindow, filters: InsightFilterParams) {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  params.set("window", window);
  if (filters.setup) params.set("setup", filters.setup);
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.session) params.set("session", filters.session);
  if (filters.side) params.set("side", filters.side);
  if (filters.playbookId) params.set("playbook_id", filters.playbookId);
  return params.toString();
}

export function useAiInsights(
  accountId?: string | null,
  options?: { enabled?: boolean; window?: InsightWindow; filters?: InsightFilterParams }
) {
  const window = options?.window ?? "30d";
  const filters = compactInsightFilters(options?.filters);
  const qs = insightsQuery(accountId, window, filters);
  return useQuery({
    queryKey: aiInsightsQueryKey(accountId, window, filters),
    queryFn: () => api.get<AiInsightsFeed>(`/api/ai/insights?${qs}`),
    enabled: options?.enabled ?? true,
  });
}

export function useRefreshAiInsights(
  accountId?: string | null,
  window: InsightWindow = "30d",
  filters?: InsightFilterParams
) {
  const qc = useQueryClient();
  const compact = compactInsightFilters(filters);
  const qs = insightsQuery(accountId, window, compact);
  return useMutation({
    mutationFn: () => api.post<AiInsightsFeed>(`/api/ai/insights/refresh?${qs}`),
    onSuccess: (data) => {
      qc.setQueryData(aiInsightsQueryKey(accountId, window, compact), data);
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
