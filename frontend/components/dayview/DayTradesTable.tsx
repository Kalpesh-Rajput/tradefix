"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { pnlHex } from "@/components/dayview/pnlStyle";
import { useLocale } from "@/components/providers/LocaleProvider";
import { dash, tradeRoi } from "@/lib/trades/previewStats";
import type { Trade } from "@/lib/types";

export type DayTradeColumnId =
  | "opened_at"
  | "symbol"
  | "side"
  | "qty_entry"
  | "instrument"
  | "pnl"
  | "roi"
  | "r_multiple"
  | "playbook"
  | "replay";

export type DayTradeColumn = {
  id: DayTradeColumnId;
  label: string;
  align?: "left" | "right" | "center";
  className?: string;
};

export const DEFAULT_DAY_TRADE_COLUMNS: DayTradeColumnId[] = [
  "opened_at",
  "symbol",
  "side",
  "qty_entry",
  "pnl",
];

export const DETAIL_DAY_TRADE_COLUMNS: DayTradeColumnId[] = [
  "opened_at",
  "symbol",
  "side",
  "instrument",
  "pnl",
  "roi",
  "r_multiple",
  "playbook",
];

export function DayTradesTable({
  trades,
  formatMoney,
  columns = DEFAULT_DAY_TRADE_COLUMNS,
  columnLabels,
  className,
}: {
  trades: Trade[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  columns?: DayTradeColumnId[];
  columnLabels?: Partial<Record<DayTradeColumnId, string>>;
  className?: string;
}) {
  const { t } = useLocale();
  const router = useRouter();

  const defs: Record<DayTradeColumnId, DayTradeColumn> = {
    opened_at: { id: "opened_at", label: t("dayView.col.time"), className: "w-[96px]" },
    symbol: { id: "symbol", label: t("common.symbol"), className: "w-[100px]" },
    side: { id: "side", label: t("dayView.col.side"), className: "w-[72px]" },
    qty_entry: { id: "qty_entry", label: t("dayView.col.qtyEntry"), className: "min-w-[120px]" },
    instrument: { id: "instrument", label: t("dayView.col.instrument"), className: "min-w-[140px]" },
    pnl: { id: "pnl", label: t("dayView.col.pnl"), align: "right", className: "w-[108px]" },
    roi: { id: "roi", label: t("dayView.col.netRoi"), align: "right", className: "w-[88px]" },
    r_multiple: { id: "r_multiple", label: t("dayView.col.rMultiple"), align: "right", className: "w-[140px]" },
    playbook: { id: "playbook", label: t("dayView.col.playbook"), className: "min-w-[120px]" },
    replay: { id: "replay", label: t("dayView.col.replay"), align: "center", className: "w-[64px]" },
  };

  const visible = columns.map((id) => ({
    ...defs[id],
    label: columnLabels?.[id] ?? defs[id].label,
  }));

  if (trades.length === 0) return null;

  return (
    <div className={clsx("mt-4 overflow-x-auto rounded-md border border-[var(--color-border)]", className)}>
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="bg-[#F7F5FB] text-[11px] font-medium text-[#8B8D96]">
            {visible.map((col) => (
              <th
                key={col.id}
                className={clsx(
                  "h-8 px-3 font-medium",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const net = Number(trade.pnl ?? 0);
            return (
              <tr
                key={trade.id}
                className="cursor-pointer border-t border-[#EEEFF2] bg-white text-[12px] hover:bg-[#F7F8FA]"
                onClick={() => router.push(`/trades/${trade.id}`)}
              >
                {visible.map((col) => (
                  <td
                    key={col.id}
                    className={clsx(
                      "h-10 px-3 align-middle",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                  >
                    <Cell trade={trade} column={col.id} net={net} formatMoney={formatMoney} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function instrumentLabel(trade: Trade) {
  const expiry = trade.expiry_date?.slice(0, 10);
  if (expiry) {
    const [y, m, d] = expiry.split("-");
    if (y && m && d) return `${trade.symbol} ${m}-${d}-${y}`;
  }
  if (trade.asset_type && trade.asset_type !== "stock") {
    return `${trade.symbol} ${trade.asset_type}`;
  }
  return trade.symbol;
}

function Cell({
  trade,
  column,
  net,
  formatMoney,
}: {
  trade: Trade;
  column: DayTradeColumnId;
  net: number;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  if (column === "opened_at") {
    return <span className="tabular-nums text-[#6B6E78]">{trade.opened_at.slice(11, 16)}</span>;
  }
  if (column === "symbol") {
    return (
      <span className="inline-flex rounded-md bg-[#E8EEF4] px-1.5 py-0.5 text-[11px] font-semibold text-[#3B4A5A]">
        {trade.symbol}
      </span>
    );
  }
  if (column === "side") {
    return <span className="font-medium uppercase tracking-wide text-[#1F2128]">{trade.side}</span>;
  }
  if (column === "qty_entry") {
    return (
      <span className="tabular-nums text-[#6B6E78]">
        {trade.quantity} @ {trade.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    );
  }
  if (column === "instrument") {
    return <span className="text-[#4A4D57]">{instrumentLabel(trade)}</span>;
  }
  if (column === "pnl") {
    return (
      <span className="font-semibold tabular-nums" style={{ color: pnlHex(net) }}>
        {formatMoney(net, { signed: true, digits: 2 }).replace(/^\+/, "")}
      </span>
    );
  }
  if (column === "roi") {
    const roi = tradeRoi(trade);
    return (
      <span className="tabular-nums text-[#4A4D57]">
        {roi == null ? "—" : `${roi.toFixed(2)}%`}
      </span>
    );
  }
  if (column === "r_multiple") {
    return (
      <span className="tabular-nums text-[#4A4D57]">
        {trade.r_multiple == null ? "—" : `${Number(trade.r_multiple).toFixed(2)}R`}
      </span>
    );
  }
  if (column === "playbook") {
    const label = dash(trade.strategy_name || trade.setup_tag);
    if (trade.playbook_id) {
      return (
        <Link
          href={`/playbooks/${trade.playbook_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:underline"
        >
          {label}
        </Link>
      );
    }
    return <span className="text-[#4A4D57]">{label}</span>;
  }
  return <span className="text-[var(--color-text-muted)]">—</span>;
}
