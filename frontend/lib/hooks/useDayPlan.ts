"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DayPlan, DayPlanImpact } from "@/lib/my-day";

export function dayPlanKey(accountId?: string, date?: string) {
  return ["day-plan", accountId, date] as const;
}

export function useDayPlan(accountId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: dayPlanKey(accountId, date),
    queryFn: () => api.get<DayPlan>(`/api/day-plans/by-day?account_id=${accountId}&date=${date}`),
    enabled: !!accountId && !!date,
  });
}

export function useSaveDayBriefing(accountId?: string, date?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, briefing }: { planId: string; briefing: string }) =>
      api.patch<DayPlan>(`/api/day-plans/${planId}`, { briefing }),
    onSuccess: (plan) => qc.setQueryData(dayPlanKey(accountId, date), plan),
  });
}

export function useAddDayPlanItem(accountId?: string, date?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, label }: { planId: string; label: string }) =>
      api.post<DayPlan>(`/api/day-plans/${planId}/items`, { label }),
    onSuccess: (plan) => qc.setQueryData(dayPlanKey(accountId, date), plan),
  });
}

export function useUpdateDayPlanItem(accountId?: string, date?: string) {
  const qc = useQueryClient();
  const key = dayPlanKey(accountId, date);
  return useMutation({
    mutationFn: ({
      itemId,
      label,
      done,
    }: {
      itemId: string;
      label?: string;
      done?: boolean;
    }) => api.patch<DayPlan>(`/api/day-plans/items/${itemId}`, { label, done }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DayPlan>(key);
      if (prev) {
        qc.setQueryData<DayPlan>(key, {
          ...prev,
          items: prev.items.map((item) =>
            item.id === vars.itemId
              ? { ...item, label: vars.label ?? item.label, done: vars.done ?? item.done }
              : item
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (plan) => qc.setQueryData(key, plan),
  });
}

export function useDeleteDayPlanItem(accountId?: string, date?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.delete<DayPlan>(`/api/day-plans/items/${itemId}`),
    onSuccess: (plan) => qc.setQueryData(dayPlanKey(accountId, date), plan),
  });
}

export function useAddDayPlanEvent(accountId?: string, date?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      title,
      note,
      occurs_on,
      impact,
    }: {
      planId: string;
      title: string;
      note?: string;
      occurs_on?: string;
      impact?: DayPlanImpact;
    }) => api.post<DayPlan>(`/api/day-plans/${planId}/events`, { title, note, occurs_on, impact }),
    onSuccess: (plan) => qc.setQueryData(dayPlanKey(accountId, date), plan),
  });
}

export function useDeleteDayPlanEvent(accountId?: string, date?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.delete<DayPlan>(`/api/day-plans/events/${eventId}`),
    onSuccess: (plan) => qc.setQueryData(dayPlanKey(accountId, date), plan),
  });
}
