"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { NotebookFolder } from "@/lib/types";

export function useNotebookFolders(accountId: string | undefined) {
  return useQuery({
    queryKey: ["notebook-folders", accountId],
    queryFn: () => api.get<NotebookFolder[]>(`/api/notebook-folders?account_id=${accountId}`),
    enabled: !!accountId,
  });
}

export function useCreateNotebookFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { account_id: string; name: string }) =>
      api.post<NotebookFolder>("/api/notebook-folders", data),
    onSuccess: (folder) => {
      qc.invalidateQueries({ queryKey: ["notebook-folders", folder.account_id] });
    },
  });
}

export function useUpdateNotebookFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; accountId: string; name: string }) =>
      api.patch<NotebookFolder>(`/api/notebook-folders/${id}`, { name }),
    onSuccess: (folder) => {
      qc.invalidateQueries({ queryKey: ["notebook-folders", folder.account_id] });
    },
  });
}

export function useDeleteNotebookFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      api.delete<void>(`/api/notebook-folders/${id}`).then(() => ({ id, accountId })),
    onSuccess: ({ accountId }) => {
      qc.invalidateQueries({ queryKey: ["notebook-folders", accountId] });
      qc.invalidateQueries({ queryKey: ["day-notes", accountId] });
    },
  });
}
