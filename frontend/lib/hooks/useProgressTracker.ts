"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  DailyProgress,
  ProgressSettings,
  ProgressSettingsPayload,
  ProgressSummary,
  StartDayResult,
} from "@/lib/progress-tracker/types";

export function progressQueryKey(params: {
  dateFrom?: string;
  dateTo?: string;
  accountId?: string | null;
  focusDate?: string;
}) {
  return ["progress-tracker", params.dateFrom, params.dateTo, params.accountId ?? "all", params.focusDate] as const;
}

export function useProgressSettings() {
  return useQuery({
    queryKey: ["progress-tracker", "settings"],
    queryFn: () => api.get<ProgressSettings>("/api/progress-tracker/settings"),
  });
}

export function useProgressSummary(
  dateFrom: string,
  dateTo: string,
  options?: { accountId?: string | null; focusDate?: string; enabled?: boolean }
) {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  if (options?.accountId) params.set("account_id", options.accountId);
  if (options?.focusDate) params.set("focus_date", options.focusDate);
  return useQuery({
    queryKey: progressQueryKey({
      dateFrom,
      dateTo,
      accountId: options?.accountId,
      focusDate: options?.focusDate,
    }),
    queryFn: () => api.get<ProgressSummary>(`/api/progress-tracker/summary?${params}`),
    enabled: options?.enabled ?? true,
  });
}

export function useDailyProgress(date: string | undefined, accountId?: string | null) {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  const qs = params.toString();
  return useQuery({
    queryKey: ["progress-tracker", "daily", date, accountId ?? "all"],
    queryFn: () => api.get<DailyProgress>(`/api/progress-tracker/daily/${date}${qs ? `?${qs}` : ""}`),
    enabled: !!date,
  });
}

function invalidateProgress(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["progress-tracker"] });
}

export function useSaveProgressSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProgressSettingsPayload) =>
      api.put<ProgressSettings>("/api/progress-tracker/settings", data),
    onSuccess: () => invalidateProgress(qc),
  });
}

export function useStartProgressDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date?: string) =>
      api.post<StartDayResult>("/api/progress-tracker/start-day", date ? { date } : {}),
    onSuccess: () => {
      invalidateProgress(qc);
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["recaps"] });
    },
  });
}

export function useManualRuleCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, date, completed }: { ruleId: string; date: string; completed: boolean }) =>
      api.put(`/api/progress-tracker/manual-rules/${ruleId}/completion`, { date, completed }),
    onSuccess: () => invalidateProgress(qc),
  });
}

export function useResetProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/progress-tracker/reset"),
    onSuccess: () => invalidateProgress(qc),
  });
}
