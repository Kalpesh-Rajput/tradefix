"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { PropDistance, PropProfile, PropSettings, PropSettingsInput } from "@/lib/types";

export function usePropProfiles() {
  return useQuery({
    queryKey: ["prop", "profiles"],
    queryFn: () => api.get<PropProfile[]>("/api/prop/profiles"),
  });
}

export function usePropSettings(accountId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["prop", "settings", accountId ?? "none"],
    queryFn: () =>
      api.get<PropSettings | null>(
        `/api/prop/settings?account_id=${encodeURIComponent(accountId!)}`
      ),
    enabled: (options?.enabled ?? true) && Boolean(accountId),
  });
}

export function usePropDistance(accountId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["prop", "distance", accountId ?? "none"],
    queryFn: () =>
      api.get<PropDistance>(`/api/prop/distance?account_id=${encodeURIComponent(accountId!)}`),
    enabled: (options?.enabled ?? true) && Boolean(accountId),
    refetchInterval: 60_000,
  });
}

export function useUpsertPropSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PropSettingsInput) => api.put<PropSettings>("/api/prop/settings", data),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["prop", "settings", row.account_id] });
      qc.invalidateQueries({ queryKey: ["prop", "distance", row.account_id] });
    },
  });
}
