"use client";

import Link from "next/link";
import { useState } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { formatSessionTime, money, type SessionSummary } from "@/lib/backtest/sessions";
import { useBacktestSessions, useDeleteSession, useRenameSession } from "@/lib/hooks/useBacktestSessions";

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

  if (sessions.isLoading) return <Skeleton className="h-64" />;

  if (sessions.isError) {
    return (
      <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
        Couldn’t load sessions.{" "}
        <button type="button" onClick={() => sessions.refetch()} className="text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const rows = sessions.data ?? [];
  if (rows.length === 0) {
    return (
      <div className="dash-card px-6 py-14 text-center">
        <p className="text-sm font-medium text-foreground">No manual sessions yet</p>
        <p className="mt-1 text-sm text-muted">Pick a symbol and a start time, then trade the stored candles.</p>
        <Link href="/backtest/sessions/new" className="dash-btn-primary text-on-accent mt-4 inline-flex h-10 items-center px-4">
          New session
        </Link>
      </div>
    );
  }

  return (
    <div className="dash-card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Manual sessions</h2>
        <Link href="/backtest/sessions/new" className="dash-btn-primary text-on-accent inline-flex h-9 items-center px-3 text-[13px]">
          New session
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-4 py-2 font-medium">Range</th>
              <th className="px-4 py-2 font-medium">Balance</th>
              <th className="px-4 py-2 font-medium">Net</th>
              <th className="px-4 py-2 font-medium">Trades</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.symbol}</div>
                  <div className="text-xs text-muted">{row.timeframe}</div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatSessionTime(row.start_ms)}
                  {row.end_ms != null ? ` – ${formatSessionTime(row.end_ms)}` : ""}
                  {row.updated_at ? <div className="text-xs">Updated {formatSessionTime(Date.parse(row.updated_at))}</div> : null}
                </td>
                <td className="px-4 py-3 font-mono text-foreground">{money(row.balance, row.currency)}</td>
                <td className={`px-4 py-3 font-mono ${row.net_profit >= 0 ? "text-positive" : "text-negative"}`}>
                  {money(row.net_profit, row.currency)}
                </td>
                <td className="px-4 py-3 text-muted">{row.trade_count}</td>
                <td className="px-4 py-3 capitalize text-muted">{row.status}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/backtest/sessions/${row.id}`} className="text-primary hover:underline">
                      {row.status === "active" ? "Resume" : "Summary"}
                    </Link>
                    {row.status === "active" ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          setRenaming(row.id);
                          setLabel("");
                        }}
                      >
                        Rename
                      </button>
                    ) : null}
                    <button type="button" className="text-negative hover:underline" onClick={() => setPendingDelete(row.id)}>
                      Delete
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
                        className="h-9 w-40 rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
                      />
                      <button type="submit" className="text-sm text-primary" disabled={rename.isPending}>
                        Save
                      </button>
                    </form>
                  ) : null}
                  {pendingDelete === row.id ? (
                    <div className="mt-2 flex justify-end gap-2 text-xs">
                      <span className="text-muted">Delete this session?</span>
                      <button type="button" className="text-negative" disabled={remove.isPending} onClick={() => void confirmDelete(row)}>
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
    </div>
  );
}
