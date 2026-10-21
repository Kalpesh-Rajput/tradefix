"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DrawingStore } from "@/components/chart/drawings/store";
import { ApiError, api } from "@/lib/api";
import { fromDto, toDto, type DrawingDto, type SyncBody } from "@/lib/chartDrawings";

export type DrawingsLoad = "loading" | "ready" | "error";
export type DrawingsSave = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 900;
const RETRY_DELAY_MS = 6000;

export type DrawingsWorkspace = {
  /** Stable key, e.g. `session:<id>` or `replay:<ref>`. */
  workspace: string;
  symbol: string;
  sessionId?: string | null;
};

export function useChartDrawings({ workspace, symbol, sessionId = null }: DrawingsWorkspace) {
  const [store] = useState(() => new DrawingStore());
  const [load, setLoad] = useState<DrawingsLoad>("loading");
  const [save, setSave] = useState<DrawingsSave>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const loaded = useRef(false);

  const flush = useCallback(async () => {
    if (!loaded.current || inFlight.current || store.isDragging || !store.hasDirty()) return;
    const batch = store.takeDirty();
    const body: SyncBody = { workspace, session_id: sessionId, upserts: batch.upserts.map(toDto), deletes: batch.deletes };
    inFlight.current = true;
    setSave("saving");
    try {
      await api.post("/api/chart-drawings/sync", body);
      setSave("saved");
      setError(null);
    } catch (failure) {
      store.restoreDirty(batch);
      setSave("error");
      setError(failure instanceof ApiError ? failure.message : "Couldn’t save drawings.");
      timer.current = setTimeout(() => void flush(), RETRY_DELAY_MS);
    } finally {
      inFlight.current = false;
      if (store.hasDirty() && !timer.current) timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    }
  }, [store, workspace, sessionId]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush();
    }, SAVE_DELAY_MS);
  }, [flush]);

  const fetchDrawings = useCallback(async () => {
    loaded.current = false;
    setLoad("loading");
    try {
      const query = new URLSearchParams({ workspace, symbol });
      const rows = await api.get<DrawingDto[]>(`/api/chart-drawings?${query.toString()}`);
      store.hydrate(rows.map(fromDto).filter((item) => item !== null));
      loaded.current = true;
      setLoad("ready");
    } catch {
      setLoad("error");
    }
  }, [store, workspace, symbol]);

  useEffect(() => {
    void fetchDrawings();
  }, [fetchDrawings]);

  useEffect(() => {
    const stop = store.subscribe(() => {
      if (store.hasDirty()) schedule();
    });
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      void flush();
    };
  }, [store, schedule, flush]);

  return { store, load, save, error, retryLoad: fetchDrawings, retrySave: flush };
}
