"use client";

import { useState } from "react";

import { normalizePosition, positionMetrics, roundPrice, signed } from "../metrics";
import type { DrawingStore } from "../store";
import type { BarLike, Drawing, DrawingContext } from "../types";
import { NumberField } from "./fields";

export type SimulateHandler = (metrics: NonNullable<ReturnType<typeof positionMetrics>>) => string | null;

export function PositionEditor({
  drawing,
  store,
  ctx,
  bars,
  onSimulate,
  unit,
}: {
  drawing: Drawing;
  store: DrawingStore;
  ctx: DrawingContext;
  bars: readonly BarLike[];
  onSimulate?: SimulateHandler;
  unit: string;
}) {
  const metrics = positionMetrics(drawing, bars, ctx);
  if (!metrics) return null;
  const decimals = ctx.priceDecimals;
  const setPrice = (index: 0 | 1 | 2, price: number) => {
    const anchors = drawing.anchors.map((anchor, i) => (i === index ? { ...anchor, p: roundPrice(price, decimals) } : anchor));
    store.patch(drawing.id, { anchors: normalizePosition({ ...drawing, anchors }, ctx) });
  };
  const rows: [string, string][] = [
    ["Risk", `${Math.abs(metrics.risk).toFixed(decimals)} · ${metrics.riskPercent.toFixed(2)}% · ${Math.abs(metrics.riskTicks)} ticks${metrics.riskPips != null ? ` · ${metrics.riskPips.toFixed(1)} pips` : ""}`],
    ["Reward", `${Math.abs(metrics.reward).toFixed(decimals)} · ${metrics.rewardPercent.toFixed(2)}% · ${Math.abs(metrics.rewardTicks)} ticks${metrics.rewardPips != null ? ` · ${metrics.rewardPips.toFixed(1)} pips` : ""}`],
    ["Risk / reward", metrics.ratio != null ? `1 : ${metrics.ratio.toFixed(2)}` : "—"],
    ["Bars to target", String(metrics.bars)],
    ["Est. P&L", metrics.pnlCurrency && metrics.riskPnl != null && metrics.rewardPnl != null ? `${signed(metrics.rewardPnl, 2)} / ${signed(metrics.riskPnl, 2)} ${metrics.pnlCurrency}` : (metrics.pnlNote ?? "—")],
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Entry" value={metrics.entry} decimals={decimals} onCommit={(value) => setPrice(0, value)} />
        <NumberField label={`Size (${unit})`} value={metrics.qty} decimals={2} min={0.000001} onCommit={(qty) => store.patch(drawing.id, { props: { ...drawing.props, qty } })} />
        <NumberField label="Stop" value={metrics.stop} decimals={decimals} onCommit={(value) => setPrice(1, value)} />
        <NumberField label="Target" value={metrics.target} decimals={decimals} onCommit={(value) => setPrice(2, value)} />
      </div>
      <dl className="space-y-0.5 text-[11px]">
        {rows.map(([name, value]) => (
          <div key={name} className="flex justify-between gap-3">
            <dt className="text-muted">{name}</dt>
            <dd className="text-right font-medium tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {onSimulate ? <SimulateButton metrics={metrics} onSimulate={onSimulate} /> : null}
      <p className="text-[10px] leading-snug text-muted">This plan is a drawing only. No order is sent unless you simulate it.</p>
    </div>
  );
}

function SimulateButton({ metrics, onSimulate }: { metrics: NonNullable<ReturnType<typeof positionMetrics>>; onSimulate: SimulateHandler }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="dash-btn-secondary w-full justify-center text-xs"
        onClick={() => setMessage(onSimulate(metrics) ?? "Order added to this session.")}
      >
        Simulate in this session
      </button>
      {message ? (
        <p role="status" className="mt-1 text-[11px] text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
