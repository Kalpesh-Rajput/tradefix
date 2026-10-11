import type { AdvancedPnlMode } from "@/lib/reports/advanced/types";

export interface AdvancedFilters {
  accountId: string;
  dateFrom?: string;
  dateTo?: string;
  symbols?: string[];
  sessions?: string[];
  setups?: string[];
  emotions?: string[];
  pnlMode: AdvancedPnlMode;
}

export function advancedParams(filters: AdvancedFilters): URLSearchParams {
  const params = new URLSearchParams({ account_id: filters.accountId, pnl_mode: filters.pnlMode });
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  const multi: [string, string[] | undefined][] = [
    ["symbol", filters.symbols],
    ["session", filters.sessions],
    ["setup_tag", filters.setups],
    ["emotion_tag", filters.emotions],
  ];
  for (const [name, values] of multi) {
    for (const value of values ?? []) {
      const trimmed = value.trim();
      if (trimmed) params.append(name, trimmed);
    }
  }
  return params;
}

export function advancedQueryKey(filters: AdvancedFilters): (string | string[])[] {
  return [
    filters.accountId,
    filters.pnlMode,
    filters.dateFrom ?? "",
    filters.dateTo ?? "",
    [...(filters.symbols ?? [])].map((s) => s.trim().toUpperCase()).filter(Boolean).sort(),
    [...(filters.sessions ?? [])].sort(),
    [...(filters.setups ?? [])].sort(),
    [...(filters.emotions ?? [])].sort(),
  ];
}
