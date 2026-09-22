"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { CoachAskResponse, CoachStatus, CoachWeekly } from "@/lib/types";

export function useCoachStatus(accountId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["coach", "status", accountId ?? "all"],
    queryFn: () => {
      const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
      return api.get<CoachStatus>(`/api/coach/status${qs}`);
    },
    enabled: options?.enabled ?? true,
  });
}

export function useCoachWeekly(accountId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["coach", "weekly", accountId ?? "all"],
    queryFn: () => {
      const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
      return api.get<CoachWeekly>(`/api/coach/weekly${qs}`);
    },
    enabled: options?.enabled ?? true,
  });
}

export type CoachHistoryMessage = { role: "user" | "assistant" | "coach"; content: string };

export function useCoachAsk() {
  return useMutation({
    mutationFn: (payload: {
      question: string;
      account_id?: string | null;
      history?: CoachHistoryMessage[];
      signal?: AbortSignal;
    }) =>
      api.post<CoachAskResponse>(
        "/api/ai/chat",
        {
          question: payload.question,
          account_id: payload.account_id || undefined,
          history: payload.history || [],
        },
        { signal: payload.signal }
      ),
  });
}
