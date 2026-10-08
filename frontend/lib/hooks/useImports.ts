"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ImportBatch } from "@/lib/hooks/useProviders";

export interface ImportConfirmResult {
  created: number;
  duplicates: number;
  attention: number;
  detected: number;
}

export function useUploadImport() {
  return useMutation({
    mutationFn: ({ file, accountId, onProgress }: { file: File; accountId?: string | null; onProgress?: (percent: number) => void }) => {
      const form = new FormData();
      form.append("file", file);
      const path = accountId ? `/api/imports?account_id=${encodeURIComponent(accountId)}` : "/api/imports";
      return api.uploadWithProgress<ImportBatch>(path, form, onProgress);
    },
  });
}

export function useUpdateImportMapping() {
  return useMutation({
    mutationFn: ({
      batchId,
      mapping,
      accountId,
    }: {
      batchId: string;
      mapping: Record<string, string>;
      accountId?: string;
    }) =>
      api.patch<ImportBatch>(`/api/imports/${batchId}/mapping`, {
        mapping,
        ...(accountId ? { account_id: accountId } : {}),
      }),
  });
}

export function useConfirmImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) => api.post<ImportConfirmResult>(`/api/imports/${batchId}/confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["progress-tracker"] });
      qc.invalidateQueries({ queryKey: ["ai-insights"] });
    },
  });
}
