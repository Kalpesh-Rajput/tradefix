"use client";

import clsx from "clsx";
import { Info, Star } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { useToast } from "@/components/ui/Toast";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { useUpdateTrade } from "@/lib/hooks/useTrades";
import {
  formatDateTime,
  heldLabel,
  plannedRMultiple,
  qtyLabel,
  runningPnlSeries,
  tradeGrossPnl,
  tradePoints,
  tradeRoi,
} from "@/lib/trades/previewStats";
import type { Trade } from "@/lib/types";

export function StatsTab({
  trade,
  formatMoney,
  timeZone,
  onOpenStrategy,
}: {
  trade: Trade;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  timeZone?: string;
  onOpenStrategy: () => void;
}) {
  const toast = useToast();
  const update = useUpdateTrade();
  const roi = tradeRoi(trade);
  const gross = tradeGrossPnl(trade);
  const points = tradePoints(trade);
  const plannedR = plannedRMultiple(trade);
  const series = runningPnlSeries(trade);
  const qty = qtyLabel(trade.quantity);
  const strategy = trade.strategy_name || trade.setup_tag || null;

  const [target, setTarget] = useState(trade.profit_target != null ? String(trade.profit_target) : "");
  const [stop, setStop] = useState(trade.stop_loss != null ? String(trade.stop_loss) : "");

  useEffect(() => {
    setTarget(trade.profit_target != null ? String(trade.profit_target) : "");
    setStop(trade.stop_loss != null ? String(trade.stop_loss) : "");
  }, [trade.id, trade.profit_target, trade.stop_loss]);

  async function saveNumber(field: "profit_target" | "stop_loss" | "rating", raw: string | number | null) {
    try {
      const value =
        raw == null || raw === ""
          ? null
          : typeof raw === "number"
            ? raw
            : Number(raw);
      if (typeof value === "number" && !Number.isFinite(value)) return;
      await update.mutateAsync({ id: trade.id, data: { [field]: value } });
    } catch (err) {
      toast.error("Couldn’t save", err instanceof Error ? err.message : undefined);
    }
  }

  const money = (n: number | null | undefined, digits = 2) =>
    n == null ? "—" : formatMoney(n, { signed: false, digits });

  return (
    <div className="space-y-0">
      <Row label="Side" value={trade.side.toUpperCase()} />
      <Row label="Account" value={trade.account_name || "—"} />
      <Row label="Contracts traded" value={qty} />
      <Row label="Points" value={points != null ? points.toFixed(2) : "—"} />
      <Row label="Ticks" value="—" />
      <Row label="Ticks Per Contract" value="—" />
      <Row label="Commissions & Fees" value={money(trade.fees, 2)} />
      <Row label="Net ROI" value={roi != null ? `${roi.toFixed(2)}%` : "—"} />
      <Row
        label="Gross P&L"
        value={gross == null ? "—" : formatMoney(gross, { signed: false, digits: 0 })}
        tone={gross == null ? undefined : gross >= 0 ? "pos" : "neg"}
      />
      <Row label="Adjusted Cost" value={money(trade.invested_amount, 0)} />
      <div className="flex items-center justify-between border-b border-[#EFEFF2] py-2.5">
        <span className="text-[12px] text-[var(--color-text-tertiary)]">Strategy</span>
        <button
          type="button"
          onClick={onOpenStrategy}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          {strategy || "Select Strategy"}
        </button>
      </div>
      <div className="flex items-center justify-between border-b border-[#EFEFF2] py-2.5">
        <span className="text-[12px] text-[var(--color-text-tertiary)]">Zella Scale</span>
        <span className="text-[12px] font-medium text-[var(--color-text-muted)]">—</span>
      </div>
      <div className="flex items-center justify-between border-b border-[#EFEFF2] py-2.5">
        <span className="text-[12px] text-[var(--color-text-tertiary)]">Price MAE / MFE</span>
        <span className="text-[12px] font-medium text-[var(--color-text-muted)]">—</span>
      </div>
      <div className="border-b border-[#EFEFF2] py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] text-[var(--color-text-tertiary)]">Running P&L</span>
        </div>
        {series.length >= 2 ? (
          <RunningPnlChart data={series} />
        ) : (
          <p className="text-[12px] text-[var(--color-text-muted)]">—</p>
        )}
      </div>
      <div className="flex items-center justify-between border-b border-[#EFEFF2] py-2.5">
        <span className="text-[12px] text-[var(--color-text-tertiary)]">Trade Rating</span>
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = (trade.rating ?? 0) >= star;
            return (
              <button
                key={star}
                type="button"
                disabled={update.isPending}
                onClick={() => saveNumber("rating", trade.rating === star ? null : star)}
                className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-amber-500 disabled:opacity-50"
                aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
              >
                <Star
                  className="h-4 w-4"
                  strokeWidth={1.6}
                  fill={filled ? "#F5B942" : "none"}
                  color={filled ? "#F5B942" : "currentColor"}
                />
              </button>
            );
          })}
        </div>
      </div>

      <section className="pt-4">
        <h3 className="mb-2 flex items-center gap-1 text-[12px] font-semibold" style={{ color: PNL_PROFIT_HEX }}>
          Profit Target
          <Info className="h-3 w-3 text-[var(--color-text-muted)]" strokeWidth={1.75} />
        </h3>
        <label className="mb-1.5 block text-[11px] text-[var(--color-text-tertiary)]">Target in Price</label>
        <div className="flex items-center gap-2">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={() => {
              if (target === (trade.profit_target != null ? String(trade.profit_target) : "")) return;
              void saveNumber("profit_target", target);
            }}
            placeholder="Enter Profit Target"
            inputMode="decimal"
            className="h-9 min-w-0 flex-1 rounded-xl border border-[#E2E2E7] px-2.5 text-[13px] outline-none focus:border-primary/40"
          />
          <QtyBadge qty={qty} />
        </div>
      </section>

      <section className="pt-4">
        <h3 className="mb-2 flex items-center gap-1 text-[12px] font-semibold" style={{ color: PNL_LOSS_HEX }}>
          Stop loss
          <Info className="h-3 w-3 text-[var(--color-text-muted)]" strokeWidth={1.75} />
        </h3>
        <label className="mb-1.5 block text-[11px] text-[var(--color-text-tertiary)]">Target in Price</label>
        <div className="flex items-center gap-2">
          <input
            value={stop}
            onChange={(e) => setStop(e.target.value)}
            onBlur={() => {
              if (stop === (trade.stop_loss != null ? String(trade.stop_loss) : "")) return;
              void saveNumber("stop_loss", stop);
            }}
            placeholder="Enter Stop Loss"
            inputMode="decimal"
            className="h-9 min-w-0 flex-1 rounded-xl border border-[#E2E2E7] px-2.5 text-[13px] outline-none focus:border-primary/40"
          />
          <QtyBadge qty={qty} />
        </div>
      </section>

      <div className="pt-3">
        <Row label="Initial Target" value={money(trade.profit_target)} />
        <Row label="Trade Risk" value={money(trade.risk_amount)} />
        <Row label="Planned R-Multiple" value={plannedR != null ? plannedR.toFixed(2) : "—"} />
        <Row label="Realized R-Multiple" value={trade.r_multiple != null ? Number(trade.r_multiple).toFixed(2) : "—"} />
        <Row label="Average Entry" value={money(trade.entry_price)} />
        <Row label="Average Exit" value={money(trade.exit_price)} />
        <Row label="Entry Time" value={formatDateTime(trade.opened_at, timeZone)} />
        <Row label="Exit Time" value={trade.closed_at ? formatDateTime(trade.closed_at, timeZone) : "—"} />
        <Row label="Held" value={heldLabel(trade)} />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#EFEFF2] py-2.5">
      <span className="text-[12px] text-[var(--color-text-tertiary)]">{label}</span>
      <span
        className={clsx("text-right text-[12px] font-semibold tabular-nums", !tone && "text-[var(--color-text-primary)]")}
        style={
          tone === "pos"
            ? { color: PNL_PROFIT_HEX }
            : tone === "neg"
              ? { color: PNL_LOSS_HEX }
              : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}

function QtyBadge({ qty }: { qty: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center rounded-xl border border-[#E2E2E7] px-2 text-[12px] text-[var(--color-text-secondary)]">
      Qty <span className="ml-1.5 font-semibold text-[var(--color-text-primary)]">{qty}</span>
    </div>
  );
}

function RunningPnlChart({ data }: { data: number[] }) {
  const gid = useId().replace(/:/g, "");
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-[56px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PNL_PROFIT_HEX} stopOpacity={0.35} />
              <stop offset="100%" stopColor={PNL_PROFIT_HEX} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={PNL_PROFIT_HEX}
            strokeWidth={1.5}
            fill={`url(#${gid})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
