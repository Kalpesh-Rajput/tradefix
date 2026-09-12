"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError } from "@/lib/api";
import type { DayNote, DayNoteInput } from "@/lib/types";

export function useDayNotes(accountId: string | undefined) {
  return useQuery({
    queryKey: ["day-notes", accountId],
    queryFn: () => api.get<DayNote[]>(`/api/day-notes?account_id=${accountId}`),
    enabled: !!accountId,
  });
}

export function useDayNote(accountId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ["day-notes", accountId, date],
    queryFn: async () => {
      try {
        return await api.get<DayNote>(`/api/day-notes/by-day?account_id=${accountId}&date=${date}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: !!accountId && !!date,
  });
}

export function useDayNoteById(noteId: string | undefined) {
  return useQuery({
    queryKey: ["day-notes", "id", noteId],
    queryFn: () => api.get<DayNote>(`/api/day-notes/${noteId}`),
    enabled: !!noteId,
  });
}

export function useUpsertDayNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DayNoteInput) => api.put<DayNote>("/api/day-notes", data),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["day-notes", note.account_id] });
      qc.invalidateQueries({ queryKey: ["day-notes", note.account_id, note.date.slice(0, 10)] });
      qc.invalidateQueries({ queryKey: ["day-notes", "id", note.id] });
    },
  });
}

export function usePatchDayNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      content?: string;
      template_id?: string;
      is_favorite?: boolean;
      folder_id?: string | null;
    }) => api.patch<DayNote>(`/api/day-notes/${id}`, data),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["day-notes", note.account_id] });
      qc.invalidateQueries({ queryKey: ["day-notes", note.account_id, note.date.slice(0, 10)] });
      qc.invalidateQueries({ queryKey: ["day-notes", "id", note.id] });
    },
  });
}

export function useDeleteDayNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      api.delete<void>(`/api/day-notes/${id}`).then(() => ({ id, accountId })),
    onSuccess: ({ accountId }) => {
      qc.invalidateQueries({ queryKey: ["day-notes", accountId] });
    },
  });
}

function invalidateDayNote(qc: ReturnType<typeof useQueryClient>, note: DayNote) {
  qc.invalidateQueries({ queryKey: ["day-notes", note.account_id] });
  qc.invalidateQueries({ queryKey: ["day-notes", note.account_id, note.date.slice(0, 10)] });
  qc.invalidateQueries({ queryKey: ["day-notes", "id", note.id] });
}

export function useUploadDayNoteScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      file,
      onProgress,
    }: {
      id: string;
      file: File;
      onProgress?: (percent: number) => void;
    }) => {
      const form = new FormData();
      form.append("file", file);
      return api.uploadWithProgress<DayNote>(`/api/day-notes/${id}/screenshots`, form, onProgress);
    },
    onSuccess: (note) => invalidateDayNote(qc, note),
  });
}

export function useDeleteDayNoteScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      api.delete<DayNote>(`/api/day-notes/${id}/screenshots?url=${encodeURIComponent(url)}`),
    onSuccess: (note) => invalidateDayNote(qc, note),
  });
}
