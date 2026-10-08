"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api";
import type { ProviderCatalog } from "@/lib/brokers/provider";

export interface SyncRun {
  id: string;
  kind: string;
  status: string;
  records_received: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface BrokerAccountSnapshot {
  id: string;
  masked_id: string | null;
  account_type: string | null;
  currency: string | null;
  balance: string | null;
  equity: string | null;
  journal_account_id: string | null;
}

export interface BrokerConnectionSnapshot {
  id: string;
  provider: string;
  display_name: string;
  status: string;
  paused: boolean;
  environment: string | null;
  region: string | null;
  realtime_status: string;
  last_success_at: string | null;
  last_error_message: string | null;
  account: BrokerAccountSnapshot | null;
  latest_run: SyncRun | null;
}

export interface ConnectionStatus {
  connection: BrokerConnectionSnapshot;
  run: SyncRun | null;
  events: { step: string; state: string; detail: string | null }[];
}

export interface ImportBatch {
  id: string;
  account_id?: string;
  filename: string;
  detected_format: string;
  status: string;
  row_count: number;
  valid_count: number;
  duplicate_count: number;
  attention_count: number;
  headers?: string[];
  mapping?: Record<string, string>;
  unmapped_required?: string[];
  rows: {
    row_number: number;
    status: string;
    errors: string[];
    raw: Record<string, string | null>;
    normalized: Record<string, string | null>;
  }[];
}

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.message) as { message?: string };
      if (parsed && typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    } catch {
      // detail was already a string
    }
    return error.message || "Something went wrong.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}

export function useProviderRegistry() {
  return useQuery({
    queryKey: ["brokers", "registry"],
    queryFn: () => api.get<ProviderCatalog>("/api/brokers"),
    staleTime: 300_000,
  });
}

export function useBrokerConnections() {
  return useQuery({
    queryKey: ["broker-connections"],
    queryFn: () => api.get<{ connections: BrokerConnectionSnapshot[]; egress_ip: string | null }>("/api/broker-connections"),
    staleTime: 15_000,
  });
}

export function useConnectionStatus(connectionId: string | null, active: boolean) {
  return useQuery({
    queryKey: ["broker-connections", connectionId, "status"],
    queryFn: () => api.get<ConnectionStatus>(`/api/broker-connections/${connectionId}/status`),
    enabled: Boolean(connectionId) && active,
    refetchInterval: active ? 3000 : false,
  });
}

export function useConnectProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      provider: string;
      credentials: Record<string, string>;
      history_preset: string;
      history_from?: string;
      history_to?: string;
      environment?: string;
    }) =>
      api.post<{ connection: BrokerConnectionSnapshot; sync_run_id: string }>("/api/broker-connections", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-connections"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useSyncConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post<{ sync_run_id: string; status: string }>(`/api/broker-connections/${connectionId}/sync`),
    onSuccess: (_data, connectionId) => {
      qc.invalidateQueries({ queryKey: ["broker-connections", connectionId] });
      qc.invalidateQueries({ queryKey: ["broker-connections"] });
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function usePatchConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, body }: { connectionId: string; body: { paused?: boolean } }) =>
      api.patch<BrokerConnectionSnapshot>(`/api/broker-connections/${connectionId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-connections"] });
    },
  });
}

export function useDisconnectConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post<{ status: string }>(`/api/broker-connections/${connectionId}/disconnect`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-connections"] });
    },
  });
}

export function useValidateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      api.post<BrokerConnectionSnapshot>(`/api/broker-connections/${connectionId}/validate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-connections"] });
    },
  });
}
