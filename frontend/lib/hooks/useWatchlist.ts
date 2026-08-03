"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { WatchlistItem } from "@/lib/types";

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.get<WatchlistItem[]>("/api/watchlist"),
  });
}

export function useAddWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { symbol: string; notes?: string }) => api.post<WatchlistItem>("/api/watchlist", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}

export function useDeleteWatchlistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/watchlist/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });
}
