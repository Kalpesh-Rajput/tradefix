"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { API_URL, getToken } from "@/lib/api";

const TRADE_EVENTS = new Set(["trade_created", "trade_updated", "trade_deleted"]);

function wsBaseUrl(): string {
  try {
    const u = new URL(API_URL);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.origin;
  } catch {
    return "ws://127.0.0.1:8000";
  }
}

/**
 * Subscribes to account WebSocket and invalidates trades/analytics on trade_* events.
 * Mount once under the authenticated app shell.
 */
export function useLiveAccount(enabled = true) {
  const qc = useQueryClient();
  const qcRef = useRef(qc);
  qcRef.current = qc;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const token = getToken();
    if (!token) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      const url = `${wsBaseUrl()}/ws/account?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        attempt = 0;
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type?: string };
          if (msg.type && TRADE_EVENTS.has(msg.type)) {
            qcRef.current.invalidateQueries({ queryKey: ["trades"] });
            qcRef.current.invalidateQueries({ queryKey: ["analytics"] });
            qcRef.current.invalidateQueries({ queryKey: ["calendar"] });
            qcRef.current.invalidateQueries({ queryKey: ["prop", "distance"] });
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        const delay = Math.min(30_000, 1000 * 2 ** attempt);
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [enabled]);
}
