"use client";

import { useState } from "react";

import { levelPrice, sizeForRisk, type LevelMode } from "@/lib/backtest/sessionBook";
import type { Instrument, OrderKind, Side } from "@/lib/backtest/rules";

const FIELD =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm tabular-nums text-foreground outline-none transition-colors placeholder:text-muted/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30";

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
  const unit = instrument.assetClass === "crypto" ? "units" : "lots";
  const priceText = mark != null ? mark.toFixed(instrument.priceDecimals) : "—";

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
    <section className="dash-card flex h-full min-h-[28rem] flex-col lg:min-h-0" aria-label="Order ticket">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <h2 className="text-sm font-semibold text-foreground">Order</h2>
        <span className="font-mono text-xs text-muted">{instrument.symbol}</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-[hsl(var(--surface-2))] p-1" role="group" aria-label="Side">
          <SideButton active={side === "buy"} tone="buy" label="Buy" price={priceText} onClick={() => setSide("buy")} />
          <SideButton active={side === "sell"} tone="sell" label="Sell" price={priceText} onClick={() => setSide("sell")} />
        </div>

        <label className="block text-xs font-medium text-muted">
          Order type
          <select className={FIELD} value={kind} onChange={(event) => setKind(event.target.value as OrderKind)}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
          </select>
        </label>
        {kind !== "market" ? (
          <label className="block text-xs font-medium text-muted">
            Price
            <input className={FIELD} value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" autoComplete="off" placeholder={priceText} />
          </label>
        ) : null}

        <div className="space-y-2.5 rounded-xl bg-[hsl(var(--surface-2))] p-2.5">
          <label className="block text-xs font-medium text-muted">
            Size ({unit})
            <input className={FIELD} value={size} onChange={(event) => setSize(event.target.value)} inputMode="decimal" autoComplete="off" />
          </label>
          <label className="block text-xs font-medium text-muted">
            Risk %
            <input className={FIELD} value={risk} onChange={(event) => setRisk(event.target.value)} inputMode="decimal" autoComplete="off" />
          </label>
          <button type="button" className="dash-btn-secondary h-9 w-full text-xs" onClick={applyRisk}>
            Size from risk
          </button>
          <p className="text-[11px] leading-4 text-muted">Set a stop, then size the position from this percent of balance.</p>
        </div>

        <div className="space-y-2.5 rounded-xl bg-[hsl(var(--surface-2))] p-2.5">
          <label className="block text-xs font-medium text-muted">
            Stop and target as
            <select className={FIELD} value={mode} onChange={(event) => setMode(event.target.value as LevelMode)}>
              <option value="price">Price</option>
              <option value="pips">Pips</option>
              <option value="r">R — stop in pips, target in R</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted">
              Stop
              <input className={FIELD} value={stop} onChange={(event) => setStop(event.target.value)} inputMode="decimal" autoComplete="off" placeholder="Optional" />
            </label>
            <label className="block text-xs font-medium text-muted">
              Target
              <input className={FIELD} value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" autoComplete="off" placeholder="Optional" />
            </label>
          </div>
        </div>

        {mark == null ? <p className="text-xs text-muted">Waiting for the first candle before a market order can price.</p> : null}
        {error ? (
          <p role="alert" className="rounded-lg bg-negative-soft px-2.5 py-2 text-xs leading-4 text-negative">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="shrink-0 space-y-2 border-t border-border p-3">
        <button
          type="button"
          className={`text-on-accent inline-flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${
            side === "buy"
              ? "bg-[color-mix(in_srgb,var(--color-success-text)_70%,#052e1c)] focus-visible:ring-[var(--color-success-text)]"
              : "bg-[color-mix(in_srgb,var(--color-danger-text)_82%,#3f0a0a)] focus-visible:ring-[var(--color-danger-text)]"
          }`}
          disabled={disabled}
          onClick={submit}
        >
          Place {side}
        </button>
        {hasPosition ? (
          <button type="button" className="dash-btn-secondary h-9 w-full text-xs" disabled={disabled} onClick={onClose}>
            Close position
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function SideButton({
  active,
  tone,
  label,
  price,
  onClick,
}: {
  active: boolean;
  tone: "buy" | "sell";
  label: string;
  price: string;
  onClick: () => void;
}) {
  const activeClass =
    tone === "buy"
      ? "text-on-accent bg-[color-mix(in_srgb,var(--color-success-text)_70%,#052e1c)]"
      : "text-on-accent bg-[color-mix(in_srgb,var(--color-danger-text)_82%,#3f0a0a)]";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-12 flex-col items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active ? activeClass : "text-muted hover:bg-surface hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span className={`font-mono text-[11px] font-medium tabular-nums ${active ? "text-on-accent" : "text-muted"}`}>{price}</span>
    </button>
  );
}
