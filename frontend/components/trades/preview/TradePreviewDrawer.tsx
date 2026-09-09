"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { useTrade } from "@/lib/hooks/useTrades";
import {
  formatMdY,
  heldLabel,
  tradeGrossPnl,
  tradeResult,
  tradeRoi,
} from "@/lib/trades/previewStats";
import type { Trade } from "@/lib/types";

import { ExecutionsTab } from "./ExecutionsTab";
import { NotesTab } from "./NotesTab";
import { StatsTab } from "./StatsTab";
import { StrategyTab } from "./StrategyTab";
import { TagsTab } from "./TagsTab";

export type TradePreviewTab = "stats" | "strategy" | "tags" | "executions" | "notes";

const TABS: { id: TradePreviewTab; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "strategy", label: "Strategy" },
  { id: "tags", label: "Tags" },
  { id: "executions", label: "Executions" },
  { id: "notes", label: "Notes" },
];

export function TradePreviewDrawer({
  tradeId,
  trades,
  formatMoney,
  onClose,
  onSelectTrade,
}: {
  tradeId: string;
  trades: Trade[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  onClose: () => void;
  onSelectTrade: (id: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openEdit } = useAddTradeModal();
  const { data, isLoading, isError, refetch } = useTrade(tradeId);
  const listTrade = trades.find((t) => t.id === tradeId);
  const trade = data ?? listTrade;
  const [tab, setTab] = useState<TradePreviewTab>("stats");
  const [mounted, setMounted] = useState(false);

  const index = useMemo(() => trades.findIndex((t) => t.id === tradeId), [trades, tradeId]);
  const hasPrev = index > 0;
  const hasNext = index >= 0 && index < trades.length - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const pnl = trade?.pnl ?? null;
  const roi = trade ? tradeRoi(trade) : null;
  const gross = trade ? tradeGrossPnl(trade) : null;
  const result = trade ? tradeResult(trade) : null;
  const positive = pnl == null ? null : pnl >= 0;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="trade-preview-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Close trade preview"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full flex-col overflow-hidden rounded-l-2xl bg-white shadow-[-8px_0_24px_rgba(20,20,30,0.12)] sm:w-[min(80vw,480px)] md:w-[460px]">
        <header className="shrink-0 border-b border-[#EFEFF2] px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="trade-preview-title" className="text-[16px] font-semibold text-[var(--color-text-primary)]">
              Trade Preview
            </h2>
            <div className="flex items-center gap-2">
              {trade ? (
                <button
                  type="button"
                  onClick={() => openEdit(trade.id)}
                  className="inline-flex h-8 items-center rounded-xl border border-[#E2E2E7] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[#F7F7F9]"
                >
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => router.push("/backtest")}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-[#E2E2E7] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[#F7F7F9]"
              >
                <Play className="h-3 w-3" fill="currentColor" />
                Replay
              </button>
            </div>
          </div>

          {trade ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => hasPrev && onSelectTrade(trades[index - 1].id)}
                  className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[#F5F5F7] disabled:opacity-30"
                  aria-label="Previous trade"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {trade.symbol}
                </span>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => hasNext && onSelectTrade(trades[index + 1].id)}
                  className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[#F5F5F7] disabled:opacity-30"
                  aria-label="Next trade"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-[var(--color-text-muted)]">•</span>
                <Badge tone={trade.side === "long" ? "long" : "short"}>{trade.side.toUpperCase()}</Badge>
                <Badge
                  tone={
                    trade.status === "closed"
                      ? "closed"
                      : Number(trade.sell_quantity ?? 0) > 0
                        ? "open"
                        : "open"
                  }
                >
                  {trade.status === "closed"
                    ? "Closed"
                    : Number(trade.sell_quantity ?? 0) > 0
                      ? "Partially Closed"
                      : "Open"}
                </Badge>
                {result ? (
                  <Badge tone={result === "Win" ? "win" : result === "Loss" ? "loss" : "be"}>{result}</Badge>
                ) : null}
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                Opened {formatMdY(trade.opened_at)}
                {trade.closed_at ? ` • Closed ${formatMdY(trade.closed_at)}` : ""}
                {` • Held ${heldLabel(trade)}`}
              </p>
            </>
          ) : (
            <Skeleton className="h-10 rounded-md" />
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {isLoading && !trade ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-md" />
              ))}
            </div>
          ) : isError && !trade ? (
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              Couldn’t load this trade.{" "}
              <button type="button" onClick={() => refetch()} className="font-medium text-primary hover:underline">
                Try again
              </button>
            </p>
          ) : trade ? (
            <>
              <div
                className="mb-3 overflow-hidden rounded-xl border border-[#E8E8EC]"
                style={
                  positive == null
                    ? undefined
                    : { borderLeft: `3px solid ${positive ? PNL_PROFIT_HEX : PNL_LOSS_HEX}` }
                }
              >
                <div className="px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Net P&amp;L
                  </p>
                  <p
                    className="text-[22px] font-semibold tabular-nums"
                    style={{
                      color: pnl == null ? undefined : positive ? PNL_PROFIT_HEX : PNL_LOSS_HEX,
                    }}
                  >
                    {pnl == null ? "—" : formatMoney(pnl, { signed: true, digits: 2 })}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span
                      className="rounded-lg px-1.5 py-0.5 text-[11px] font-medium"
                      style={
                        roi == null
                          ? { background: "#F4F4F6", color: "#85868e" }
                          : roi >= 0
                            ? { background: "#E7F6EE", color: PNL_PROFIT_HEX }
                            : { background: "#FDF0F1", color: PNL_LOSS_HEX }
                      }
                    >
                      ROI {roi == null ? "—" : `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`}
                    </span>
                    <span className="rounded-lg bg-[#F4F4F6] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                      Gross {gross == null ? "—" : formatMoney(gross, { signed: true, digits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sticky top-0 z-10 mb-3 overflow-x-auto rounded-xl bg-[#F4F4F6] p-0.5">
                <div className="flex min-w-max">
                  {TABS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={clsx(
                        "h-8 rounded-lg px-2.5 text-[12px] font-medium",
                        tab === item.id
                          ? "bg-white text-[var(--color-text-primary)] shadow-[0_0_0_1px_#E8E8EC]"
                          : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "stats" && (
                <StatsTab
                  trade={trade}
                  formatMoney={formatMoney}
                  timeZone={user?.timezone}
                  onOpenStrategy={() => setTab("strategy")}
                />
              )}
              {tab === "strategy" && <StrategyTab trade={trade} />}
              {tab === "tags" && <TagsTab trade={trade} />}
              {tab === "executions" && (
                <ExecutionsTab trade={trade} formatMoney={formatMoney} timeZone={user?.timezone} />
              )}
              {tab === "notes" && <NotesTab trade={trade} />}
            </>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-[#EFEFF2] bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-xl border border-[#E2E2E7] px-3 text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[#F7F7F9]"
          >
            Close
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "long" | "short" | "open" | "closed" | "win" | "loss" | "be";
}) {
  const cls =
    tone === "long"
      ? "bg-[#6B5B95] text-white"
      : tone === "short"
        ? "bg-amber-500/15 text-amber-800"
        : tone === "closed"
          ? "bg-[#F4D7C0] text-[#9A5B2F]"
          : tone === "open"
            ? "bg-[#E8F1FF] text-[#3B6CB5]"
            : tone === "win"
              ? "bg-[#D7F0E2] text-[#1F7A4D]"
              : tone === "loss"
                ? "bg-[#F8D7D7] text-[#B42318]"
                : "bg-[#EEF0F4] text-[#5B6578]";
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>
      {children}
    </span>
  );
}
