"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Columns2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { ASSET_OPTIONS } from "@/components/trade/schema";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { moodsFromTrade } from "@/lib/masters";
import type { AssetType, Trade } from "@/lib/types";
import {
  ACTIONS_COL_WIDTH,
  SELECT_COL_WIDTH,
  columnDef,
  tableMinWidth,
  type TradeColumnId,
} from "@/lib/trades/logColumns";
import { netRoiPct } from "@/lib/trades/logFilters";
import { heldLabel } from "@/lib/trades/previewStats";

function ColumnPickerButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-150",
        active
          ? "border-primary/40 bg-[var(--color-primary-light)] text-primary"
          : "border-[#E2E2E7] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
      )}
      aria-label="Select columns"
      title="Select columns"
    >
      <Columns2 className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

const headClass =
  "sticky top-0 z-10 whitespace-nowrap border-b border-[var(--color-border-light)] bg-[#F5F4F8] px-2 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[#70717A]";
const cellClass = "border-b border-[var(--color-border-light)] px-2 py-3 align-middle";

function assetLabel(type: AssetType): string {
  return ASSET_OPTIONS.find((option) => option.value === type)?.label.toLowerCase() ?? type;
}

function qtyLabel(trade: Trade): string {
  const quantity = Number(trade.quantity);
  const formatted = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(2).replace(/\.?0+$/, "");
  if (trade.asset_type === "option" || trade.asset_type === "future") return `${formatted} contracts`;
  if (trade.asset_type === "forex") return `${formatted} lots`;
  return formatted;
}

function tradeDateKey(trade: Trade): string {
  return (trade.closed_at || trade.opened_at).slice(0, 10);
}

function moneyPrice(
  value: number | null | undefined,
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string
): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return formatMoney(Number(value), { signed: false, digits: 2 });
}

function signedPct(value: number): string {
  const abs = Math.abs(value).toFixed(2);
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `−${abs}%`;
  return `${abs}%`;
}

function joinList(values: string[] | null | undefined): string {
  const text = (values ?? []).map((value) => value.trim()).filter(Boolean).join(", ");
  return text || "—";
}

export function TradeLogTable({
  trades,
  columns,
  selected,
  allVisibleSelected,
  previewTradeId,
  deletePending,
  onToggleAll,
  onToggleOne,
  onPreview,
  onDelete,
  onSelectColumns,
  columnsActive = false,
}: {
  trades: Trade[];
  columns: TradeColumnId[];
  selected: Set<string>;
  allVisibleSelected: boolean;
  previewTradeId: string | null;
  deletePending: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onPreview: (id: string) => void;
  onDelete: (trade: Trade) => void;
  onSelectColumns?: () => void;
  columnsActive?: boolean;
}) {
  const { formatDateTime } = useLocale();
  const { displayPnl, formatMoney } = useAccountPrefs();
  const minWidth = tableMinWidth(columns);

  return (
    <div className="trade-log-scroll min-h-0 flex-1 overflow-auto rounded-xl">
      <table
        className="w-full border-separate border-spacing-0 text-left text-sm"
        style={{ minWidth }}
      >
        <thead className="sticky top-0 z-10">
          <tr>
            <th className={clsx(headClass, "w-11 rounded-tl-xl py-2.5 pl-4 pr-2")} style={{ minWidth: SELECT_COL_WIDTH }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={onToggleAll}
                className="h-3.5 w-3.5 rounded-md border-[#D1D5DB] text-primary focus:ring-primary"
                aria-label="Select all"
              />
            </th>
            {columns.map((id) => {
              const column = columnDef(id);
              return (
                <th key={id} className={headClass} style={{ minWidth: column.minWidth }}>
                  {column.label}
                </th>
              );
            })}
            <th
              className={clsx(headClass, "rounded-tr-xl pr-3")}
              style={{ minWidth: ACTIONS_COL_WIDTH }}
            >
              {onSelectColumns ? (
                <span className="flex justify-end">
                  <ColumnPickerButton active={columnsActive} onClick={onSelectColumns} />
                </span>
              ) : null}
            </th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const pnl = displayPnl(trade.pnl, trade.fees);
            const roi = netRoiPct(trade, pnl);
            return (
              <tr
                key={trade.id}
                data-active={previewTradeId === trade.id ? "true" : undefined}
                onClick={() => onPreview(trade.id)}
                className="cursor-pointer"
              >
                <td className={clsx(cellClass, "pl-4 pr-2")} onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(trade.id)}
                    onChange={() => onToggleOne(trade.id)}
                    className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-primary focus:ring-primary"
                    aria-label={`Select ${trade.symbol}`}
                  />
                </td>
                {columns.map((id) => (
                  <TradeCell
                    key={id}
                    column={id}
                    trade={trade}
                    pnl={pnl}
                    roi={roi}
                    formatMoney={formatMoney}
                    formatDateTime={formatDateTime}
                  />
                ))}
                <td className={clsx(cellClass, "pr-4")} onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Link
                      href={`/trades/${trade.id}`}
                      className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors duration-150 hover:bg-[var(--color-primary-light)] hover:text-primary"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(trade)}
                      disabled={deletePending}
                      className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors duration-150 hover:bg-[var(--color-danger-bg)] hover:text-negative disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TradeCell({
  column,
  trade,
  pnl,
  roi,
  formatMoney,
  formatDateTime,
}: {
  column: TradeColumnId;
  trade: Trade;
  pnl: number | null;
  roi: number | null;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  formatDateTime: (value: Date | string | number | null | undefined) => string;
}) {
  const width = columnDef(column).minWidth;

  if (column === "date") {
    return (
      <td className={clsx(cellClass, "whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]")} style={{ minWidth: width }}>
        {tradeDateKey(trade)}
      </td>
    );
  }

  if (column === "ticker") {
    return (
      <td className={cellClass} style={{ minWidth: width }} onClick={(event) => event.stopPropagation()}>
        <Link
          href={`/trades/${trade.id}`}
          className="inline-flex rounded-lg bg-[var(--color-primary-light)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--color-text-primary)] hover:bg-primary/15 hover:text-primary"
        >
          {trade.symbol}
        </Link>
      </td>
    );
  }

  if (column === "class") {
    return (
      <td className={cellClass} style={{ minWidth: width }}>
        <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary-light)] px-2 py-0.5 text-[11px] font-medium capitalize text-primary">
          <span className="opacity-70">⌁</span>
          {assetLabel(trade.asset_type)}
        </span>
      </td>
    );
  }

  if (column === "side") {
    const isLong = trade.side === "long";
    return (
      <td className={cellClass} style={{ minWidth: width }}>
        <span
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
            isLong ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-700"
          )}
        >
          {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trade.side}
        </span>
      </td>
    );
  }

  if (column === "pnl" || column === "roi") {
    const value = column === "pnl" ? pnl : roi;
    const text =
      column === "pnl"
        ? pnl == null
          ? "—"
          : formatMoney(pnl, { digits: Math.abs(pnl) < 10 ? 2 : 0 })
        : roi == null
          ? "—"
          : signedPct(roi);
    return (
      <td
        className={clsx(
          cellClass,
          "whitespace-nowrap font-mono text-xs font-semibold",
          value == null && "text-[var(--color-text-muted)]"
        )}
        style={{
          minWidth: width,
          color: value == null ? undefined : value >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX,
        }}
      >
        {text}
      </td>
    );
  }

  const text = plainText(column, trade, formatMoney, formatDateTime);
  const clip = column === "notes" || column === "strategy" || column === "rules" || column === "mood" || column === "emotion";
  const mono =
    column === "entry" ||
    column === "exit" ||
    column === "fees" ||
    column === "risk" ||
    column === "stop" ||
    column === "target" ||
    column === "rMultiple";
  return (
    <td
      className={clsx(
        cellClass,
        "text-xs",
        clip ? "max-w-[220px] truncate text-[var(--color-text-secondary)]" : "whitespace-nowrap",
        mono ? "font-mono text-[var(--color-text-primary)]" : !clip && "text-[var(--color-text-secondary)]"
      )}
      style={{ minWidth: width }}
      title={clip && text !== "—" ? text : undefined}
    >
      {text}
    </td>
  );
}

function plainText(
  column: TradeColumnId,
  trade: Trade,
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string,
  formatDateTime: (value: Date | string | number | null | undefined) => string
): string {
  switch (column) {
    case "qty":
      return qtyLabel(trade);
    case "entry":
      return moneyPrice(trade.entry_price, formatMoney);
    case "exit":
      return moneyPrice(trade.exit_price, formatMoney);
    case "strategy":
      return trade.setup_tag || "—";
    case "notes":
      return trade.notes?.trim() || "—";
    case "entryTime":
      return formatDateTime(trade.opened_at);
    case "exitTime":
      return trade.closed_at ? formatDateTime(trade.closed_at) : "—";
    case "held":
      return heldLabel(trade);
    case "fees":
      return formatMoney(Number(trade.fees) || 0, { signed: false, digits: 2 });
    case "risk":
      return moneyPrice(trade.risk_amount, formatMoney);
    case "rMultiple":
      return trade.r_multiple == null ? "—" : Number(trade.r_multiple).toFixed(2);
    case "status":
      return trade.status === "open" ? "Open" : "Closed";
    case "session":
      return trade.session?.trim() || "—";
    case "mood":
      return joinList(moodsFromTrade(trade));
    case "emotion":
      return joinList(trade.emotion_tags);
    case "rating":
      return trade.rating == null ? "—" : `${trade.rating}/5`;
    case "account":
      return trade.account_name?.trim() || "—";
    case "stop":
      return moneyPrice(trade.stop_loss, formatMoney);
    case "target":
      return moneyPrice(trade.profit_target, formatMoney);
    case "leverage":
      return trade.leverage == null ? "—" : `${Number(trade.leverage)}x`;
    case "tradeType":
      return trade.trade_type?.trim() || "—";
    case "rules":
      return joinList(trade.rules_broken);
    default:
      return "—";
  }
}
