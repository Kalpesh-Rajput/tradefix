"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DailyCheckin, DailyCheckinInput, MilestonesResponse } from "@/lib/types";

export function useCheckins(limit = 90) {
  return useQuery({
    queryKey: ["checkins", limit],
    queryFn: () => api.get<DailyCheckin[]>(`/api/checkins?limit=${limit}`),
  });
}

export function useTodayCheckin(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return useQuery({
    queryKey: ["checkins", "today", date ?? "default"],
    queryFn: () => api.get<DailyCheckin | null>(`/api/checkins/today${qs}`),
  });
}

export function useMilestones() {
  return useQuery({
    queryKey: ["checkins", "milestones"],
    queryFn: () => api.get<MilestonesResponse>("/api/checkins/milestones"),
  });
}

export function useUpsertCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DailyCheckinInput) => api.post<DailyCheckin>("/api/checkins", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkins"] });
    },
  });
}
