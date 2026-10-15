"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { RunTrade } from "@/lib/hooks/useBacktestRuns";

type SortKey = "entry_ms" | "pnl" | "pips" | "r_multiple" | "bars_held";

export function RunTradesTable({
  runId,
  trades,
  total,
  side,
  exitReason,
  onFilter,
}: {
  runId: string;
  trades: RunTrade[];
  total: number;
  side: string;
  exitReason: string;
  onFilter: (next: { side: string; exitReason: string }) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "entry_ms", dir: 1 });
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = trades.slice().sort((a, b) => ((a[sort.key] ?? 0) > (b[sort.key] ?? 0) ? sort.dir : -sort.dir));
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 36, overscan: 8 });

  function toggle(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  return (
    <section className="dash-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">Trades ({total})</h2>
        <div className="flex gap-2">
          <select className="h-9 rounded-lg border border-border bg-surface px-2 text-sm" value={side} onChange={(event) => onFilter({ side: event.target.value, exitReason })}>
            <option value="">All sides</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <select className="h-9 rounded-lg border border-border bg-surface px-2 text-sm" value={exitReason} onChange={(event) => onFilter({ side, exitReason: event.target.value })}>
            <option value="">All exits</option>
            {["tp", "sl", "manual", "end of data"].map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.6fr_0.6fr_0.7fr_0.5fr_0.8fr_0.7fr] gap-2 px-2 text-[11px] uppercase tracking-wide text-muted">
        <Sort label="Time" onClick={() => toggle("entry_ms")} />
        <span>Side</span>
        <span>Entry</span>
        <span>Exit</span>
        <Sort label="Pips" onClick={() => toggle("pips")} />
        <Sort label="R" onClick={() => toggle("r_multiple")} />
        <Sort label="Result" onClick={() => toggle("pnl")} />
        <Sort label="Bars" onClick={() => toggle("bars_held")} />
        <span>Reason</span>
        <span>Replay</span>
      </div>
      <div ref={parentRef} className="mt-1 h-96 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => {
            const trade = rows[item.index];
            return (
              <div
                key={trade.seq}
                className="absolute left-0 grid w-full grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr_0.6fr_0.6fr_0.7fr_0.5fr_0.8fr_0.7fr] gap-2 border-t border-border/60 px-2 text-sm"
                style={{ height: item.size, transform: `translateY(${item.start}px)` }}
              >
                <span className="truncate py-2 text-muted">{new Date(trade.entry_ms).toISOString().slice(0, 16).replace("T", " ")}</span>
                <span className="py-2">{trade.side}</span>
                <span className="py-2 font-mono">{trade.entry_price}</span>
                <span className="py-2 font-mono">{trade.exit_price}</span>
                <span className="py-2 font-mono">{trade.pips.toFixed(1)}</span>
                <span className="py-2 font-mono">{trade.r_multiple == null ? "—" : trade.r_multiple.toFixed(2)}</span>
                <span className={`py-2 font-mono ${trade.pnl >= 0 ? "text-positive" : "text-negative"}`}>{trade.pnl.toFixed(2)}</span>
                <span className="py-2">{trade.bars_held}</span>
                <span className="truncate py-2 text-muted">{trade.exit_reason}</span>
                <Link href={`/replay/run/${runId}/${trade.seq}`} className="py-2 text-primary hover:underline">Open</Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Sort({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="text-left hover:text-foreground" onClick={onClick}>
      {label}
    </button>
  );
}
