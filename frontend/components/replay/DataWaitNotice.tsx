"use client";

import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";

const FALLBACK_SLOW_MS = 180_000;

type WorkerStatus = {
  stale: boolean;
  slow_after_s: number;
  message: string | null;
  command?: string;
  heartbeat_age_s?: number | null;
};

export function DataWaitNotice({ since }: { since?: string | null }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(Date.now());
  const started = since ? Date.parse(since) : mounted.current;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<WorkerStatus>("/api/market-data/worker")
      .then((body) => {
        if (!cancelled) setStatus(body);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slowAfter = (status?.slow_after_s ?? FALLBACK_SLOW_MS / 1000) * 1000;
  const slow = Number.isFinite(started) && now - started >= slowAfter;
  const offline = status?.stale === true;
  if (!slow && !offline) return null;
  const admin = user?.role === "admin";
  return (
    <div className="mt-3 max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
      <p>{offline ? "The background worker appears offline." : "This is taking longer than expected."}</p>
      {admin && offline && status?.command ? (
        <p className="mt-1 text-xs text-muted">
          Heartbeat age {status.heartbeat_age_s == null ? "unknown" : `${status.heartbeat_age_s}s`}. Start it with <code>{status.command}</code>.
        </p>
      ) : null}
    </div>
  );
}
