"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, api } from "@/lib/api";
import { retryDelayMs, type SaveBatch } from "@/lib/backtest/sessionPersistence";

export type SavePhase = "idle" | "saving" | "saved" | "error";

function retryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.code === "network" || error.code === "rate_limited" || error.status === 0 || error.status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useSessionPersistence(sessionId: string, read: () => SaveBatch | null) {
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const readRef = useRef(read);
  readRef.current = read;
  const saving = useRef(false);

  const save = useCallback(async (batch?: SaveBatch | null) => {
    const payload = batch === undefined ? readRef.current() : batch;
    if (!payload || saving.current) return false;
    saving.current = true;
    setPhase("saving");
    setDetail(null);
    let attempt = 0;
    try {
      for (;;) {
        try {
          await api.put(`/api/backtest/sessions/${sessionId}/state`, {
            cursor_ms: payload.cursorMs,
            notes: payload.notes,
          });
          if (payload.orders.length) {
            await api.post(`/api/backtest/sessions/${sessionId}/orders`, { orders: payload.orders });
          }
          if (payload.trades.length) {
            await api.post(`/api/backtest/sessions/${sessionId}/trades`, { trades: payload.trades });
          }
          setPhase("saved");
          return true;
        } catch (error) {
          const delay = retryable(error) ? retryDelayMs(attempt, error instanceof ApiError ? error.retryAfterS : undefined) : null;
          attempt += 1;
          if (delay == null) {
            setPhase("error");
            setDetail(error instanceof ApiError ? error.message : "Couldn’t save the session.");
            return false;
          }
          await sleep(delay);
        }
      }
    } finally {
      saving.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [save]);

  return { phase, detail, save };
}
