"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { AssetType, TradeInput, TradeSide, TradeStatus } from "@/lib/types";

const MOOD_OPTIONS = ["1", "2", "3", "4", "5"];

function toLocalDatetimeInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TradeForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Partial<TradeInput>;
  onSubmit: (data: TradeInput) => void;
  submitting?: boolean;
}) {
  const [form, setForm] = useState<TradeInput>({
    symbol: initial?.symbol ?? "",
    asset_type: (initial?.asset_type as AssetType) ?? "stock",
    side: (initial?.side as TradeSide) ?? "long",
    quantity: initial?.quantity ?? 0,
    entry_price: initial?.entry_price ?? 0,
    exit_price: initial?.exit_price ?? null,
    opened_at: initial?.opened_at ?? new Date().toISOString(),
    closed_at: initial?.closed_at ?? null,
    fees: initial?.fees ?? 0,
    setup_tag: initial?.setup_tag ?? "",
    mood: initial?.mood ?? "",
    notes: initial?.notes ?? "",
    status: (initial?.status as TradeStatus) ?? "closed",
  });

  function update<K extends keyof TradeInput>(key: K, value: TradeInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Symbol</Label>
          <Input required value={form.symbol} onChange={(e) => update("symbol", e.target.value.toUpperCase())} placeholder="AAPL" />
        </div>
        <div>
          <Label>Asset type</Label>
          <Select value={form.asset_type} onChange={(e) => update("asset_type", e.target.value as AssetType)}>
            <option value="stock">Stock</option>
            <option value="option">Option</option>
            <option value="future">Future</option>
            <option value="forex">Forex</option>
            <option value="crypto">Crypto</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Side</Label>
          <Select value={form.side} onChange={(e) => update("side", e.target.value as TradeSide)}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onChange={(e) => update("status", e.target.value as TradeStatus)}>
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Quantity</Label>
          <Input type="number" step="any" required value={form.quantity} onChange={(e) => update("quantity", Number(e.target.value))} />
        </div>
        <div>
          <Label>Entry price</Label>
          <Input type="number" step="any" required value={form.entry_price} onChange={(e) => update("entry_price", Number(e.target.value))} />
        </div>
        <div>
          <Label>Exit price</Label>
          <Input
            type="number"
            step="any"
            value={form.exit_price ?? ""}
            onChange={(e) => update("exit_price", e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Opened at</Label>
          <Input
            type="datetime-local"
            required
            value={toLocalDatetimeInput(form.opened_at)}
            onChange={(e) => update("opened_at", new Date(e.target.value).toISOString())}
          />
        </div>
        <div>
          <Label>Closed at</Label>
          <Input
            type="datetime-local"
            value={toLocalDatetimeInput(form.closed_at)}
            onChange={(e) => update("closed_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Fees</Label>
          <Input type="number" step="any" value={form.fees} onChange={(e) => update("fees", Number(e.target.value))} />
        </div>
        <div>
          <Label>Setup tag</Label>
          <Input value={form.setup_tag ?? ""} onChange={(e) => update("setup_tag", e.target.value)} placeholder="Breakout" />
        </div>
        <div>
          <Label>Mood (1-5)</Label>
          <Select value={form.mood ?? ""} onChange={(e) => update("mood", e.target.value)}>
            <option value="">—</option>
            {MOOD_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value)} placeholder="What did you see? What would you do differently?" />
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Saving…" : "Save trade"}
      </Button>
    </form>
  );
}
