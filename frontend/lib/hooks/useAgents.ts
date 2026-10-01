"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { AgentRun, AgentTemplate, AppNotification, UserAgent } from "@/lib/types";

export function useAgentTemplates() {
  return useQuery({
    queryKey: ["agents", "templates"],
    queryFn: () => api.get<AgentTemplate[]>("/api/agents/templates"),
  });
}

export function useUserAgents() {
  return useQuery({
    queryKey: ["agents", "configured"],
    queryFn: () => api.get<UserAgent[]>("/api/agents"),
  });
}

export function useAgentRuns() {
  return useQuery({
    queryKey: ["agents", "runs"],
    queryFn: () => api.get<AgentRun[]>("/api/agents/runs"),
  });
}

export function useAgentRun(runId: string | null) {
  return useQuery({
    queryKey: ["agents", "run", runId],
    queryFn: () => api.get<AgentRun>(`/api/agents/runs/${runId}`),
    enabled: Boolean(runId),
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      template_key: string;
      status?: string;
      trigger_types?: string[];
      configuration?: UserAgent["configuration"];
      instructions?: string;
    }) => api.post<UserAgent>("/api/agents", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: Partial<Pick<UserAgent, "status" | "trigger_types" | "configuration" | "instructions">> }) =>
      api.patch<UserAgent>(`/api/agents/${input.id}`, input.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/agents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useRunAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; trigger?: string; account_id?: string; date?: string; trade_ids?: string[] }) =>
      api.post<AgentRun>(`/api/agents/${input.id}/run`, {
        trigger: input.trigger ?? "manual",
        account_id: input.account_id,
        date: input.date,
        trade_ids: input.trade_ids ?? [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["day-plan"] });
      qc.invalidateQueries({ queryKey: ["day-notes"] });
      qc.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useRetryAgentRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<AgentRun>(`/api/agents/runs/${runId}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<AppNotification[]>("/api/notifications"),
    refetchInterval: 60_000,
  });
}

export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AppNotification>(`/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDecideAiTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tradeId: string; tag: string; accept: boolean }) =>
      api.post(`/api/trades/${input.tradeId}/ai-tags/${input.accept ? "accept" : "reject"}`, { tag: input.tag }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trades"] }),
  });
}
