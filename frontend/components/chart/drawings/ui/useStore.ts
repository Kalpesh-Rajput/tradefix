"use client";

import { useSyncExternalStore } from "react";

import type { DrawingStore } from "../store";

/** Re-renders when the store changes structurally (not on every drag frame). */
export function useStoreVersion(store: DrawingStore): number {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getVersion(),
    () => 0
  );
}
