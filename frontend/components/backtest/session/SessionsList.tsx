"use client";

import { ArrowRight, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { HubEmpty } from "@/components/backtest/hub/HubEmpty";
import { HubPanel } from "@/components/backtest/hub/HubPanel";
import { pnlClass } from "@/components/backtest/hub/pnl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { pairLabel } from "@/lib/backtest/hubStats";
import { formatSessionTime, money, type SessionSummary } from "@/lib/backtest/sessions";
import { useBacktestSessions, useDeleteSession, useRenameSession } from "@/lib/hooks/useBacktestSessions";

const NEW_SESSION =
  "dash-btn-primary text-on-accent inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.7)]";
const ICON_BTN =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none";

function StatusPill({ status }: { status: SessionSummary["status"] }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
        active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-surface text-muted"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-primary motion-safe:animate-pulse" : "bg-muted/60"}`} aria-hidden />
      {status}
    </span>
  );
}

export function SessionsList() {
  const sessions = useBacktestSessions();
  const remove = useDeleteSession();
  const rename = useRenameSession();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [label, setLabel] = useState("");

  async function confirmDelete(row: SessionSummary) {
    try {
      await remove.mutateAsync(row.id);
      toast.success("Session deleted");
      setPendingDelete(null);
    } catch (error) {
      toast.error("Couldn’t delete the session", error instanceof ApiError ? error.message : "Try again.");
    }
  }

  async function confirmRename(row: SessionSummary) {
    const notes = label.trim();
    if (!notes) {
      toast.error("Add a name", "The session name can’t be empty.");
      return;
    }
    try {
      await rename.mutateAsync({ id: row.id, cursorMs: row.cursor_ms, notes });
      toast.success("Session renamed");
      setRenaming(null);
    } catch (error) {
      toast.error("Couldn’t rename the session", error instanceof ApiError ? error.message : "Try again.");
    }
  }

  if (sessions.isLoading) {
    return (
      <HubPanel title="Manual sessions">
        <div className="space-y-3 p-5">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </HubPanel>
    );
  }

  if (sessions.isError) {
    return (
      <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
        Couldn’t load sessions.{" "}
        <button type="button" onClick={() => sessions.refetch()} className="font-medium text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const rows = sessions.data ?? [];
  if (rows.length === 0) {
    return (
      <HubEmpty
        icon={Play}
        title="Your practice desk is empty"
        body="Pick a symbol and a start time, then trade the stored candles one bar at a time."
        action={
          <Link href="/backtest/sessions/new" className={NEW_SESSION}>
            <Plus className="h-4 w-4" aria-hidden />
            New session
          </Link>
        }
      />
    );
  }

  return (
    <HubPanel
      title="Manual sessions"
      subtitle={`${rows.length} ${rows.length === 1 ? "session" : "sessions"} · resume any time, progress is saved`}
      action={
        <Link href="/backtest/sessions/new" className={NEW_SESSION}>
          <Plus className="h-4 w-4" aria-hidden />
          New session
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-[11px] uppercase tracking-[0.12em] text-muted">
              <th scope="col" className="px-5 py-2.5 font-medium">Symbol</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Range</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Balance</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Net</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Trades</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group border-b border-border/60 align-top transition-colors last:border-b-0 hover:bg-primary/[0.035]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-gradient-to-br from-primary/15 to-primary/5 text-[11px] font-bold tracking-tight text-primary">
                      {row.symbol.slice(0, 3)}
                    </span>
                    <div>
                      <div className="font-semibold tracking-tight text-foreground">{pairLabel(row.symbol)}</div>
                      <div className="text-xs text-muted">{row.timeframe}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-muted">
                  <div className="text-foreground/90">
                    {formatSessionTime(row.start_ms)}
                    {row.end_ms != null ? ` – ${formatSessionTime(row.end_ms)}` : ""}
                  </div>
                  {row.updated_at ? <div className="mt-0.5 text-xs">Updated {formatSessionTime(Date.parse(row.updated_at))}</div> : null}
                </td>
                <td className="px-3 py-3.5 text-right font-mono tabular-nums text-foreground">{money(row.balance, row.currency)}</td>
                <td className={`px-3 py-3.5 text-right font-mono font-medium tabular-nums ${pnlClass(row.net_profit)}`}>
                  {money(row.net_profit, row.currency)}
                </td>
                <td className="px-3 py-3.5 text-right font-mono tabular-nums text-muted">{row.trade_count}</td>
                <td className="px-3 py-3.5">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/backtest/sessions/${row.id}`}
                      className="mr-1 inline-flex h-8 items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none"
                    >
                      {row.status === "active" ? "Resume" : "Summary"}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                    {row.status === "active" ? (
                      <button
                        type="button"
                        className={ICON_BTN}
                        aria-label={`Rename ${pairLabel(row.symbol)} session`}
                        title="Rename"
                        onClick={() => {
                          setRenaming(row.id);
                          setLabel("");
                        }}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`${ICON_BTN} hover:!bg-[var(--color-danger-bg)] hover:!text-[var(--color-danger-text)]`}
                      aria-label={`Delete ${pairLabel(row.symbol)} session`}
                      title="Delete"
                      onClick={() => setPendingDelete(row.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  {renaming === row.id ? (
                    <form
                      className="mt-2 flex justify-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void confirmRename(row);
                      }}
                    >
                      <label className="sr-only" htmlFor={`rename-${row.id}`}>
                        Session name
                      </label>
                      <input
                        id={`rename-${row.id}`}
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        maxLength={4000}
                        autoFocus
                        placeholder="Session name"
                        className="h-9 w-44 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
                      />
                      <button type="submit" className="text-sm font-medium text-primary" disabled={rename.isPending}>
                        Save
                      </button>
                      <button type="button" className="text-sm text-muted" onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : null}
                  {pendingDelete === row.id ? (
                    <div className="mt-2 flex items-center justify-end gap-3 text-xs" role="alert">
                      <span className="text-muted">Delete this session?</span>
                      <button
                        type="button"
                        className="font-medium text-[var(--color-danger-text)]"
                        disabled={remove.isPending}
                        onClick={() => void confirmDelete(row)}
                      >
                        Delete
                      </button>
                      <button type="button" className="text-muted" onClick={() => setPendingDelete(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </HubPanel>
  );
}
