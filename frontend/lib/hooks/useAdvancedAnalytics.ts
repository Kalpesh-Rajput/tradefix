"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { advancedParams, advancedQueryKey, type AdvancedFilters } from "@/lib/reports/advanced/query";
import type { AdvancedAnalytics, DrillRef, DrilldownResult } from "@/lib/reports/advanced/types";

export function useAdvancedAnalytics(filters: AdvancedFilters | null) {
  return useQuery({
    queryKey: ["analytics-advanced", ...(filters ? advancedQueryKey(filters) : [])],
    queryFn: ({ signal }) =>
      api.get<AdvancedAnalytics>(`/api/analytics/advanced?${advancedParams(filters!).toString()}`, { signal }),
    enabled: !!filters?.accountId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useAnalyticsDrilldown(filters: AdvancedFilters | null, drill: DrillRef | null) {
  return useQuery({
    queryKey: ["analytics-drilldown", ...(filters ? advancedQueryKey(filters) : []), drill?.dimension ?? "", drill?.key ?? ""],
    queryFn: ({ signal }) => {
      const params = advancedParams(filters!);
      params.set("dimension", drill!.dimension);
      params.set("key", drill!.key);
      return api.get<DrilldownResult>(`/api/analytics/advanced/drilldown?${params.toString()}`, { signal });
    },
    enabled: !!filters?.accountId && !!drill,
    staleTime: 30_000,
  });
}
