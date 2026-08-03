"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { MoodCheckin } from "@/lib/types";

export function useMoodCheckins() {
  return useQuery({
    queryKey: ["mood"],
    queryFn: () => api.get<MoodCheckin[]>("/api/mood"),
  });
}

export function useUpsertMoodCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { date: string; mood_score: number; notes?: string }) =>
      api.post<MoodCheckin>("/api/mood", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mood"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
