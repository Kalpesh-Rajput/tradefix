"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { MentorAccess, TradeComment } from "@/lib/types";

export function useMentorStudents(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mentor", "students"],
    queryFn: () => api.get<MentorAccess[]>("/api/mentor/students"),
    enabled: options?.enabled ?? true,
  });
}

export function useMentorCoaches(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mentor", "coaches"],
    queryFn: () => api.get<MentorAccess[]>("/api/mentor/coaches"),
    enabled: options?.enabled ?? true,
  });
}

export function useInviteCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => api.post<MentorAccess>("/api/mentor/invite", { email }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor", "coaches"] });
    },
  });
}

export function useTradeComments(tradeId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mentor", "comments", tradeId],
    queryFn: () => api.get<TradeComment[]>(`/api/mentor/trades/${tradeId}/comments`),
    enabled: (options?.enabled ?? true) && Boolean(tradeId),
  });
}

export function useAddTradeComment(tradeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api.post<TradeComment>(`/api/mentor/trades/${tradeId}/comments`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mentor", "comments", tradeId] });
    },
  });
}
