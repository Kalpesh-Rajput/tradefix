"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { AnalyticsResponse, CalendarResponse } from "@/lib/types";

export interface AnalyticsFilters {
  account_id?: string | null;
  date_from?: string;
  date_to?: string;
  setup_tag?: string;
  emotion_tag?: string;
  symbol?: string;
  session?: string;
}

function buildAnalyticsQuery(filters: AnalyticsFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.account_id) params.set("account_id", filters.account_id);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.setup_tag) params.set("setup_tag", filters.setup_tag);
  if (filters.emotion_tag) params.set("emotion_tag", filters.emotion_tag);
  if (filters.symbol) params.set("symbol", filters.symbol);
  if (filters.session) params.set("session", filters.session);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAnalytics(
  accountIdOrFilters?: string | null | AnalyticsFilters,
  options?: { enabled?: boolean }
) {
  const filters: AnalyticsFilters =
    typeof accountIdOrFilters === "object" && accountIdOrFilters !== null
      ? accountIdOrFilters
      : { account_id: accountIdOrFilters };

  return useQuery({
    queryKey: [
      "analytics",
      filters.account_id ?? "all",
      filters.date_from ?? "",
      filters.date_to ?? "",
      filters.setup_tag ?? "",
      filters.emotion_tag ?? "",
      filters.symbol ?? "",
      filters.session ?? "",
    ],
    queryFn: () => api.get<AnalyticsResponse>(`/api/analytics${buildAnalyticsQuery(filters)}`),
    enabled: options?.enabled ?? true,
  });
}

export function useCalendar(
  start: string,
  end: string,
  accountId?: string | null,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["calendar", start, end, accountId ?? "all"],
    queryFn: () => {
      const params = new URLSearchParams({ start, end });
      if (accountId) params.set("account_id", accountId);
      return api.get<CalendarResponse>(`/api/calendar?${params.toString()}`);
    },
    enabled: (options?.enabled ?? true) && Boolean(start && end),
  });
}
