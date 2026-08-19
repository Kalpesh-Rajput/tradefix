"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";

import { useLocale } from "@/components/providers/LocaleProvider";
import type { Trade } from "@/lib/types";

export function PositionsTradesWidget({
  openTrades,
  recentTrades,
  formatMoney,
}: {
  openTrades: Trade[];
  recentTrades: Trade[];
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  const { t, formatDate } = useLocale();
  const [tab, setTab] = useState<"open" | "recent">("recent");
  const rows = tab === "open" ? openTrades : recentTrades;

  return (
    <div className="dash-card flex min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 border-b border-[var(--color-divider)] px-1.5">
        <TabButton active={tab === "open"} onClick={() => setTab("open")}>
          {t("dashboard.openPositions")}
        </TabButton>
        <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
          {t("dashboard.recentTrades")}
        </TabButton>
      </div>

      <div className="min-h-[240px] max-h-[320px] flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2 px-4 text-center">
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
                const pnl = trade.pnl ?? 0;
                const when = trade.closed_at || trade.opened_at;
                return (
                  <tr
                    key={trade.id}
                    className="border-b border-[var(--color-border-light)] last:border-0 transition-colors duration-150 hover:bg-[var(--color-primary-very-light)]"
                  >
                    <td className="h-9 px-3 text-[12px] text-[var(--color-text-secondary)]">
                      <Link
                        href={`/trades/${trade.id}`}
                        className="hover:text-[var(--color-text-primary)]"
                      >
                        {formatDate(new Date(when))}
                      </Link>
                    </td>
                    <td className="h-9 px-3 text-[12px] font-medium text-[#25262B]">
                      <Link href={`/trades/${trade.id}`}>{trade.symbol}</Link>
                    </td>
                    <td
                      className={clsx(
                        "h-9 px-3 text-right text-[12px] font-medium tabular-nums",
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
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-150",
        active
          ? "border-b-2 border-primary text-primary"
          : "border-b-2 border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {children}
    </button>
  );
}
