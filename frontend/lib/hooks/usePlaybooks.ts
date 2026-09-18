"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { PlaybookCreateInput, PlaybookTemplate, UserPlaybook } from "@/lib/playbooks/types";

export function usePlaybookTemplates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["playbook-templates"],
    queryFn: () => api.get<PlaybookTemplate[]>("/api/playbook-templates"),
    enabled: options?.enabled ?? true,
  });
}

export function usePlaybooks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["playbooks"],
    queryFn: () => api.get<UserPlaybook[]>("/api/playbooks"),
    enabled: options?.enabled ?? true,
  });
}

export function usePlaybook(id: string | undefined) {
  return useQuery({
    queryKey: ["playbooks", id],
    queryFn: () => api.get<UserPlaybook>(`/api/playbooks/${id}`),
    enabled: !!id,
  });
}

export function useCreatePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaybookCreateInput) => api.post<UserPlaybook>("/api/playbooks", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      qc.invalidateQueries({ queryKey: ["masters"] });
    },
  });
}

export function useClonePlaybookTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.post<UserPlaybook>("/api/playbooks/from-template", { slug }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      qc.invalidateQueries({ queryKey: ["masters"] });
    },
  });
}

export function useUpdatePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlaybookCreateInput> }) =>
      api.patch<UserPlaybook>(`/api/playbooks/${id}`, data),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["playbooks"] });
      qc.invalidateQueries({ queryKey: ["playbooks", row.id] });
    },
  });
}

export function useDeletePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/playbooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }),
  });
}
