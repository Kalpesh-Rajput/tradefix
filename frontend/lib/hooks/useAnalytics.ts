"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { AnalyticsResponse, CalendarResponse } from "@/lib/types";

export function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.get<AnalyticsResponse>("/api/analytics"),
  });
}

export function useCalendar(start: string, end: string) {
  return useQuery({
    queryKey: ["calendar", start, end],
    queryFn: () => api.get<CalendarResponse>(`/api/calendar?start=${start}&end=${end}`),
  });
}
