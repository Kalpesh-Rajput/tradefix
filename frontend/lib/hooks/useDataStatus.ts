"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type InstrumentStatus = {
  symbol: string;
  asset_class: string;
  source: string;
  enabled: boolean;
  covered_from: number | null;
  covered_to: number | null;
  row_count: number;
  gap_minutes: number;
  outliers: number;
  updated_at: string | null;
};

export type FailedJob = {
  id: string;
  type: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string | null;
};

export type SymbolAlias = { id: string; broker: string; raw_symbol: string; canonical_symbol: string };

export type UnresolvedSymbol = {
  id: string;
  broker: string;
  raw_symbol: string;
  count: number;
  interest_count: number;
  last_seen: string | null;
};

export type TimeOffsetRow = {
  account_id: string;
  account_name: string;
  user_email: string;
  tz_value: string;
  confidence: string;
  match_rate: number;
  sample_size: number;
};

export type CrosscheckRow = {
  instrument: string;
  day: string;
  stored_close: number | null;
  reference_close: number | null;
  difference: number | null;
  tolerance: number;
  status: string;
};

const KEY = ["admin-data-status"] as const;

export function useDataStatus(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      api.get<{ instruments: InstrumentStatus[]; failures: FailedJob[]; crosschecks: CrosscheckRow[]; crosscheck_differences: CrosscheckRow[] }>(
        "/api/admin/data-status",
      ),
    enabled,
  });
}

export function useAliases() {
  return useQuery({ queryKey: ["admin-aliases"], queryFn: () => api.get<SymbolAlias[]>("/api/admin/aliases") });
}

export function useUnresolved() {
  return useQuery({ queryKey: ["admin-unresolved"], queryFn: () => api.get<UnresolvedSymbol[]>("/api/admin/unresolved") });
}

export function useTimeOffsets() {
  return useQuery({ queryKey: ["admin-time-offsets"], queryFn: () => api.get<TimeOffsetRow[]>("/api/admin/time-offsets") });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ id: string; status: string }>(`/api/admin/jobs/${id}/retry`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEnqueueBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { symbol: string; start_ms: number; end_ms: number }) =>
      api.post<{ job_id: string; created: boolean }>("/api/admin/backfill", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { broker: string; raw_symbol: string; canonical: string }) => api.post<SymbolAlias>("/api/admin/aliases", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-aliases"] }),
  });
}

export type CandleImportResult = {
  rows_read: number;
  rows_kept: number;
  rejected: Record<string, number>;
  range_start: number | null;
  range_end: number | null;
  gap_minutes: number;
  dry_run: boolean;
  duplicate: boolean;
  price_side: string;
  label: string;
};

export function useImportCandles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.postForm<CandleImportResult>("/api/admin/candle-imports", form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/admin/aliases/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-aliases"] }),
  });
}
