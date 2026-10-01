"use client";

import { useEffect, useSyncExternalStore } from "react";

export type AssistantScope = {
  dateFrom?: string | null;
  dateTo?: string | null;
  detail?: string | null;
};

const EMPTY: AssistantScope = {};

let current: AssistantScope = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: AssistantScope) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function useAssistantScope(): AssistantScope {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

export function usePublishAssistantScope(scope: AssistantScope) {
  const dateFrom = scope.dateFrom ?? "";
  const dateTo = scope.dateTo ?? "";
  const detail = scope.detail ?? "";

  useEffect(() => {
    publish({
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      detail: detail || null,
    });
    return () => publish(EMPTY);
  }, [dateFrom, dateTo, detail]);
}
