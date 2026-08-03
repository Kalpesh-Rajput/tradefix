"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";

import {
  AddTradeFormValues,
  ASSET_OPTIONS,
  completionPercent,
  estimatePnl,
  riskReward,
  tradeDurationHours,
} from "@/components/trade/schema";
import { fmtMoney } from "@/lib/format";

export function TradeSummary({ values }: { values: AddTradeFormValues }) {
  const pnl = estimatePnl(values);
  const rr = riskReward(values);
  const duration = tradeDurationHours(values);
  const pct = completionPercent(values);
  const asset = ASSET_OPTIONS.find((a) => a.value === values.asset_type)?.label ?? values.asset_type;

  const checks = [
    { label: "Symbol", ok: !!values.symbol },
    { label: "Prices", ok: values.entry_price > 0 && (values.status === "open" || !!values.exit_price) },
    { label: "Timing", ok: !!values.entryDate && !!values.entryTime },
    { label: "Setup tagged", ok: values.strategies.length > 0 },
  ];

  return (
    <aside className="hidden w-[280px] shrink-0 lg:block">
      <div className="sticky top-0 space-y-4">
        <motion.div
          layout
          className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-5 shadow-card"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Live Summary</p>

          <div className="mt-4 space-y-3 text-sm">
            <Row label="Asset" value={asset} />
            <Row
              label="Direction"
              value={values.side}
              tone={values.side === "long" ? "accent" : "danger"}
            />
            <Row label="Symbol" value={values.symbol || "—"} />
            <Row label="Fees" value={fmtMoney(Number(values.fees || 0), { signed: false })} />
            <Row
              label="Est. P&L"
              value={pnl == null ? "—" : fmtMoney(pnl)}
              tone={pnl == null ? undefined : pnl >= 0 ? "accent" : "danger"}
            />
            <Row label="R:R" value={rr == null ? "—" : `1:${rr.toFixed(2)}`} />
            <Row
              label="Duration"
              value={duration == null ? "—" : duration < 1 ? `${Math.round(duration * 60)}m` : `${duration.toFixed(1)}h`}
            />
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted">Completion</span>
              <span className="font-medium text-accent">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs">
                {c.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted" />
                )}
                <span className={c.ok ? "text-white" : "text-muted"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </aside>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span
        className={`font-medium capitalize ${
          tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
