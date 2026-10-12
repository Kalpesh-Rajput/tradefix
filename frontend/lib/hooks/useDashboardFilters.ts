"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_FILTERS,
  advancedFilterCount,
  completeFilters,
  pickAdvanced,
  type AdvancedFilterValue,
} from "@/lib/trades/logFilters";

const STORAGE_KEY = "tradefix_dashboard_filters";

function readStored(): AdvancedFilterValue {
  if (typeof window === "undefined") return pickAdvanced(DEFAULT_FILTERS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return pickAdvanced(DEFAULT_FILTERS);
    return pickAdvanced(completeFilters(JSON.parse(raw) as Partial<AdvancedFilterValue>));
  } catch {
    return pickAdvanced(DEFAULT_FILTERS);
  }
}

export function useDashboardAdvancedFilters(saveFilters: boolean | undefined) {
  const [filters, setFilters] = useState<AdvancedFilterValue>(() => pickAdvanced(DEFAULT_FILTERS));
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (saveFilters === undefined) return;
    if (saveFilters) setFilters(readStored());
    setHydrated(true);
  }, [saveFilters]);

  useEffect(() => {
    if (!hydrated || saveFilters === undefined) return;
    if (!saveFilters) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters, saveFilters, hydrated]);

  const count = advancedFilterCount(filters) + (filters.status !== "all" ? 1 : 0);

  return { filters, setFilters, open, setOpen, count, active: count > 0 };
}
