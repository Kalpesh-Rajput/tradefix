"use client";

import { ExternalLink, PanelLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

import { formatNetPnl, pnlHex } from "@/components/dayview/pnlStyle";
import { ScreenshotGrid } from "@/components/media/ScreenshotGrid";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useDeleteTradeScreenshot, useTrade, useUpdateTrade, useUploadTradeScreenshot } from "@/lib/hooks/useTrades";
import { parseLocalIso } from "@/lib/dateLocal";

const MAX_SHOTS = 5;
const MAX_NOTES = 5000;

export function TradeNotePanel({
  tradeId,
  locale,
  formatMoney,
  onDirtyChange,
  onToggleFolders,
}: {
  tradeId: string;
  locale: string;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  onDirtyChange?: (dirty: boolean) => void;
  onToggleFolders?: () => void;
}) {
  const toast = useToast();
  const { data: trade, isLoading, isError, refetch } = useTrade(tradeId);
  const updateTrade = useUpdateTrade();
  const uploadShot = useUploadTradeScreenshot();
  const deleteShot = useDeleteTradeScreenshot();
  const [notes, setNotes] = useState("");
  const [baseline, setBaseline] = useState("");
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (!trade || trade.id !== tradeId) return;
    if (loadedId.current === tradeId) return;
    loadedId.current = tradeId;
    const next = trade.notes ?? "";
    setNotes(next);
    setBaseline(next);
  }, [trade, tradeId]);

  const dirty = notes !== baseline;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const shots = trade?.screenshot_urls ?? [];
  const canUpload = shots.length < MAX_SHOTS;

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop: async (files) => {
      if (!trade || !files.length) return;
      const room = MAX_SHOTS - shots.length;
      try {
        for (const file of files.slice(0, room)) {
          await uploadShot.mutateAsync({ id: trade.id, file });
        }
        toast.success("Screenshot added");
      } catch (err) {
        toast.error("Couldn’t upload screenshot", err instanceof Error ? err.message : undefined);
      }
    },
    accept: { "image/png": [], "image/jpeg": [], "image/webp": [] },
    multiple: true,
    noClick: true,
    disabled: !trade || !canUpload || uploadShot.isPending,
  });

  async function save() {
    if (!trade) return false;
    try {
      await updateTrade.mutateAsync({ id: trade.id, data: { notes } });
      setBaseline(notes);
      toast.success("Trade note saved");
      return true;
    } catch (err) {
      toast.error("Couldn’t save note", err instanceof Error ? err.message : undefined);
      return false;
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-5">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (isError || !trade) {
    return (
      <div className="p-6 text-sm text-[var(--color-text-secondary)]">
        Couldn’t load this trade.{" "}
        <button type="button" onClick={() => void refetch()} className="text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const pnl = Number(trade.pnl ?? 0);
  const when = (trade.closed_at || trade.opened_at).slice(0, 10);
  const title = parseLocalIso(when).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface)]">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-1">
          {onToggleFolders ? (
            <button
              type="button"
              onClick={onToggleFolders}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
              aria-label="Toggle folders"
            >
              <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
          <h2 className="truncate text-[15px] font-semibold text-[var(--color-text-primary)]">
            {trade.symbol} · {trade.side}
          </h2>
        </div>
        <Link
          href={`/trades/${trade.id}`}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]"
        >
          Open trade
          <ExternalLink className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-3 sm:px-5">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
              {title}
              <span className="mx-2 text-[var(--color-text-muted)]">·</span>
              Net P&L{" "}
              <span className="font-semibold tabular-nums" style={{ color: pnlHex(pnl) }}>
                {formatNetPnl(pnl, formatMoney)}
              </span>
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
              {trade.quantity} {trade.asset_type} · {trade.status}
              {trade.strategy_name ? ` · ${trade.strategy_name}` : ""}
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-5">
          <label className="mb-1.5 block text-[12px] font-medium text-[var(--color-text-secondary)]">Notes</label>
          <Textarea
            rows={10}
            maxLength={MAX_NOTES}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why did you take this trade? What will you repeat or avoid?"
          />
          <p className="mt-1 text-right text-[10px] tabular-nums text-[var(--color-text-muted)]">
            {notes.length}/{MAX_NOTES}
          </p>
        </div>

        <div className="px-4 py-4 sm:px-5" {...getRootProps()}>
          <input {...getInputProps()} />
          <ScreenshotGrid
            urls={shots}
            max={MAX_SHOTS}
            uploading={uploadShot.isPending}
            canAdd={canUpload && !uploadShot.isPending}
            onAdd={open}
            onDelete={async (url) => {
              try {
                await deleteShot.mutateAsync({ id: trade.id, url });
                toast.success("Screenshot removed");
              } catch (err) {
                toast.error("Couldn’t delete screenshot", err instanceof Error ? err.message : undefined);
              }
            }}
          />
        </div>
      </div>

      <div className="flex shrink-0 justify-end border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => void save()}
          disabled={updateTrade.isPending}
          className="dash-btn-primary text-on-accent min-w-[72px] disabled:opacity-60"
        >
          {updateTrade.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
