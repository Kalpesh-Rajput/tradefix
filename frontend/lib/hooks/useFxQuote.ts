"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { isValidCode, mergeCurrencies } from "@/lib/fx/catalog";
import type { FxCurrencyList, FxQuote } from "@/lib/fx/types";

export function useFxCurrencies() {
  return useQuery({
    queryKey: ["fx-currencies"],
    queryFn: () => api.get<FxCurrencyList>("/api/fx/currencies"),
    staleTime: 60 * 60_000,
    select: (data) => mergeCurrencies(data.currencies),
  });
}

export function useFxQuote(base: string, quote: string) {
  const qc = useQueryClient();
  const enabled = isValidCode(base) && isValidCode(quote);
  const query = useQuery({
    queryKey: ["fx-quote", base, quote],
    queryFn: () => api.get<FxQuote>(`/api/fx/quote?base=${base}&quote=${quote}`),
    enabled,
    staleTime: 4 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const refresh = useMutation({
    mutationFn: () => api.get<FxQuote>(`/api/fx/quote?base=${base}&quote=${quote}&refresh=true`),
    onSuccess: (data) => {
      qc.setQueryData(["fx-quote", data.base, data.quote], data);
    },
  });

  return {
    quote: query.data,
    isLoading: query.isPending && !query.data,
    isFetching: query.isFetching,
    error: refresh.error ?? query.error,
    refreshFailed: Boolean(refresh.error),
    refetch: query.refetch,
    forceRefresh: () => refresh.mutate(),
    refreshing: refresh.isPending,
  };
}
