"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { AgentRun, Insight } from "@/lib/types";

export function useAgentList() {
  return useQuery({
    queryKey: ["agents", "list"],
    queryFn: () => api.get<string[]>("/api/agents"),
  });
}

export function useAgentRuns() {
  return useQuery({
    queryKey: ["agents", "runs"],
    queryFn: () => api.get<AgentRun[]>("/api/agents/runs"),
  });
}

export function useAgentInsights() {
  return useQuery({
    queryKey: ["agents", "insights"],
    queryFn: () => api.get<Insight[]>("/api/agents/insights"),
  });
}

export function useRunAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentName: string) => api.post(`/api/agents/${agentName}/run`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
    },
  });
}
