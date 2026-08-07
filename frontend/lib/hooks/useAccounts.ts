import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Account, AccountInput, AccountUpdateInput } from "@/lib/types";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<Account[]>("/api/accounts"),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AccountInput) => api.post<Account>("/api/accounts", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AccountUpdateInput }) =>
      api.patch<Account>(`/api/accounts/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useSetDefaultAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Account>(`/api/accounts/${id}/set-default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export async function exportAccountTrades(accountId: string, accountName: string) {
  const safe = accountName.replace(/\s+/g, "_").toLowerCase() || "account";
  await api.download(`/api/accounts/${accountId}/export`, `${safe}_trades.csv`);
}
