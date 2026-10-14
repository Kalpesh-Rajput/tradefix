"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError, api } from "@/lib/api";

function interestFrom(error: ApiError): { raw_symbol: string; broker?: string } | null {
  const details = error.details;
  if (!details || typeof details !== "object") return null;
  const raw = (details as { raw_symbol?: unknown }).raw_symbol;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const broker = (details as { broker?: unknown }).broker;
  return { raw_symbol: raw.trim(), broker: typeof broker === "string" ? broker : undefined };
}

export function ReplayStates({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const toast = useToast();
  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const interest = error.code === "unresolved_symbol" ? interestFrom(error) : null;
  const waiting = error.code === "rate_limited";
  const canRetry = error.code !== "unresolved_symbol" && error.code !== "instrument_not_supported" && error.code !== "not_found" && error.code !== "feature_not_allowed";

  const title =
    error.code === "unresolved_symbol"
      ? "This symbol isn't supported yet"
      : error.code === "instrument_not_supported"
        ? "Replay isn't available for this market yet"
        : error.code === "not_found"
          ? "Trade not found"
          : error.code === "quota_exceeded"
            ? "Limit reached"
            : waiting
              ? "Too many requests"
              : error.code === "network" || error.status === 0
                ? "Connection problem"
                : "Replay unavailable";

  return (
    <div className="flex min-h-[420px] flex-1 flex-col items-start justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-[var(--color-text-secondary)]">{error.message}</p>
      {waiting && error.retryAfterS ? (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">Trying again in about {error.retryAfterS}s.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {canRetry ? (
          <Button size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
        {interest && !requested ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={sending}
            onClick={() => {
              setSending(true);
              api
                .post("/api/market-data/symbol-interest", interest)
                .then(() => {
                  setRequested(true);
                  toast.success("Request recorded. We'll use it to decide what to add.");
                })
                .catch(() => toast.error("Could not record that request."))
                .finally(() => setSending(false));
            }}
          >
            Request support for {interest.raw_symbol}
          </Button>
        ) : null}
        {requested ? <p className="self-center text-xs text-[var(--color-text-muted)]">Request recorded.</p> : null}
      </div>
    </div>
  );
}

export function ReplaySkeleton() {
  return (
    <div className="flex h-full min-h-[640px] flex-col gap-3" aria-busy="true" aria-label="Loading replay">
      <div className="h-[72px] animate-pulse rounded-xl bg-[var(--color-border-subtle)]" />
      <div className="min-h-[420px] flex-1 animate-pulse rounded-xl bg-[var(--color-border-subtle)]" />
      <div className="h-16 animate-pulse rounded-xl bg-[var(--color-border-subtle)]" />
    </div>
  );
}
