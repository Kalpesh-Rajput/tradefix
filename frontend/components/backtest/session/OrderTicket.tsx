"use client";

import { useState } from "react";

import { levelPrice, sizeForRisk, type LevelMode } from "@/lib/backtest/sessionBook";
import type { Instrument, OrderKind, Side } from "@/lib/backtest/rules";

const FIELD = "h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground";

export function OrderTicket({
  instrument,
  balance,
  mark,
  hasPosition,
  disabled,
  onPlace,
  onClose,
}: {
  instrument: Instrument;
  balance: number;
  mark: number | null;
  hasPosition: boolean;
  disabled: boolean;
  onPlace: (input: { side: Side; kind: OrderKind; size: number; price: number | null; sl: number | null; tp: number | null }) => string | null;
  onClose: () => void;
}) {
  const [side, setSide] = useState<Side>("buy");
  const [kind, setKind] = useState<OrderKind>("market");
  const [size, setSize] = useState("0.01");
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<LevelMode>("price");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [risk, setRisk] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const reference = kind === "market" ? mark : Number(price);
  const stopLevel = stop.trim() ? levelPrice({ side, role: "sl", mode, value: Number(stop), reference: reference || 0, pipSize: instrument.pipSize, stopDistance: null }) : null;

  function applyRisk() {
    const distance = stopLevel != null && reference ? Math.abs(reference - stopLevel) : 0;
    const suggested = sizeForRisk(balance, Number(risk), distance, instrument);
    if (suggested == null) {
      setError("Enter a stop and a risk percent first.");
      return;
    }
    setSize(suggested.toFixed(instrument.assetClass === "crypto" ? 6 : 2));
    setError(null);
  }

  function submit() {
    const stopDistance = stopLevel != null && reference ? Math.abs(reference - stopLevel) : null;
    const sl = stop.trim()
      ? levelPrice({ side, role: "sl", mode, value: Number(stop), reference: Number(reference), pipSize: instrument.pipSize, stopDistance })
      : null;
    const tp = target.trim()
      ? levelPrice({ side, role: "tp", mode, value: Number(target), reference: Number(reference), pipSize: instrument.pipSize, stopDistance })
      : null;
    const message = onPlace({
      side,
      kind,
      size: Number(size),
      price: kind === "market" ? null : Number(price),
      sl,
      tp,
    });
    setError(message);
  }

  return (
    <section className="dash-card space-y-3 p-3" aria-label="Order ticket">
      <div className="flex gap-2">
        <button type="button" className={`h-9 flex-1 rounded-lg text-sm ${side === "buy" ? "bg-[var(--color-chart-profit)] text-white" : "border border-border text-muted"}`} onClick={() => setSide("buy")}>
          Buy {mark != null ? mark.toFixed(instrument.priceDecimals) : ""}
        </button>
        <button type="button" className={`h-9 flex-1 rounded-lg text-sm ${side === "sell" ? "bg-[var(--color-chart-loss)] text-white" : "border border-border text-muted"}`} onClick={() => setSide("sell")}>
          Sell
        </button>
      </div>
      <label className="block text-xs text-muted">
        Order
        <select className={`${FIELD} mt-1`} value={kind} onChange={(event) => setKind(event.target.value as OrderKind)}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
        </select>
      </label>
      {kind !== "market" ? (
        <label className="block text-xs text-muted">
          Price
          <input className={`${FIELD} mt-1`} value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
        </label>
      ) : null}
      <label className="block text-xs text-muted">
        Size ({instrument.assetClass === "crypto" ? "units" : "lots"})
        <input className={`${FIELD} mt-1`} value={size} onChange={(event) => setSize(event.target.value)} inputMode="decimal" />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1 text-xs text-muted">
          Risk %
          <input className={`${FIELD} mt-1`} value={risk} onChange={(event) => setRisk(event.target.value)} inputMode="decimal" />
        </label>
        <button type="button" className="dash-btn-secondary mt-4 h-9 px-2 text-xs" onClick={applyRisk}>
          Size from risk
        </button>
      </div>
      <label className="block text-xs text-muted">
        Stop and target as
        <select className={`${FIELD} mt-1`} value={mode} onChange={(event) => setMode(event.target.value as LevelMode)}>
          <option value="price">Price</option>
          <option value="pips">Pips</option>
          <option value="r">R (stop in pips, target in R)</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted">
          Stop
          <input className={`${FIELD} mt-1`} value={stop} onChange={(event) => setStop(event.target.value)} inputMode="decimal" />
        </label>
        <label className="block text-xs text-muted">
          Target
          <input className={`${FIELD} mt-1`} value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" />
        </label>
      </div>
      {error ? <p className="text-xs text-negative">{error}</p> : null}
      <button type="button" className="dash-btn-primary text-on-accent h-9 w-full" disabled={disabled} onClick={submit}>
        Place {side}
      </button>
      {hasPosition ? (
        <button type="button" className="dash-btn-secondary h-9 w-full" disabled={disabled} onClick={onClose}>
          Close position
        </button>
      ) : null}
    </section>
  );
}
