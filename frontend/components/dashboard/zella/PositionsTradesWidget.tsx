"use client";

import clsx from "clsx";
import { useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import type { Trade } from "@/lib/types";

export function PositionsTradesWidget({
  openTrades,
  recentTrades,
  formatMoney,
  displayPnl,
  truncated,
  compact = false,
}: {
  openTrades: Trade[];
  recentTrades: Trade[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  displayPnl?: (pnl: number | null | undefined, fees?: number | null) => number | null;
  truncated?: boolean;
  compact?: boolean;
}) {
  const { t, formatDate } = useLocale();
  const { openEdit } = useAddTradeModal();
  const [tab, setTab] = useState<"open" | "recent">("recent");
  const rows = tab === "open" ? openTrades : recentTrades;

  return (
    <div className="dash-card flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className={clsx(
          "flex shrink-0 items-center border-b border-[var(--color-divider)] px-2",
          compact ? "h-9" : "h-11"
        )}
      >
        <TabButton compact={compact} active={tab === "open"} onClick={() => setTab("open")}>
          {t("dashboard.openPositions")}
        </TabButton>
        <TabButton compact={compact} active={tab === "recent"} onClick={() => setTab("recent")}>
          {t("dashboard.recentTrades")}
        </TabButton>
      </div>

      <div className={clsx("min-h-0 flex-1 overflow-auto", compact ? "min-h-0" : "min-h-[240px] lg:min-h-0")}>
        {rows.length === 0 ? (
          <div
            className={clsx(
              "flex h-full flex-col items-center justify-center gap-2 px-4 text-center",
              compact ? "min-h-0" : "min-h-[120px]"
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-lg text-[var(--color-text-muted)]">
              ∅
            </div>
            <p className="text-[12px] text-[var(--color-text-secondary)]">
              {tab === "open" ? t("dashboard.noOpenPositions") : t("journal.noMatch")}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--color-surface-secondary)] text-[10px] font-medium text-[var(--color-text-tertiary)]">
              <tr className="border-b border-[var(--color-border-light)]">
                <th className="px-3 py-2 font-medium">{t("dashboard.closeDate")}</th>
                <th className="px-3 py-2 font-medium">{t("common.symbol")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("dashboard.netPnl")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((trade) => {
                const pnl = displayPnl ? (displayPnl(trade.pnl, trade.fees) ?? 0) : (trade.pnl ?? 0);
                const when = trade.closed_at || trade.opened_at;
                const openTrade = () => openEdit(trade.id);
                return (
                  <tr
                    key={trade.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${trade.symbol} trade`}
                    onClick={openTrade}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openTrade();
                      }
                    }}
                    className="cursor-pointer border-b border-[var(--color-border-light)] last:border-0 transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]"
                  >
                    <td
                      className={clsx(
                        compact ? "h-8" : "h-9",
                        "px-3 text-[12px] text-[var(--color-text-secondary)]"
                      )}
                    >
                      {formatDate(new Date(when))}
                    </td>
                    <td
                      className={clsx(
                        compact ? "h-8" : "h-9",
                        "px-3 text-[12px] font-medium text-[#25262B]"
                      )}
                    >
                      {trade.symbol}
                    </td>
                    <td
                      className={clsx(
                        compact ? "h-8" : "h-9",
                        "px-3 text-right text-[12px] font-medium tabular-nums",
                        pnl >= 0 ? "text-positive" : "text-negative"
                      )}
                    >
                      {formatMoney(pnl, { signed: true, digits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {truncated ? (
        <p className="shrink-0 border-t border-[var(--color-border-light)] px-3 py-1.5 text-[10px] text-[var(--color-text-muted)]">
          Showing the latest 1,000 trades in this range.
        </p>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 text-[10px] font-medium uppercase tracking-wider transition-colors duration-150",
        compact ? "h-9" : "h-11",
        active
          ? "border-b-2 border-primary text-primary"
          : "border-b-2 border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {children}
    </button>
  );
}
