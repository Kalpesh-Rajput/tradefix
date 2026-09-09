"use client";

import clsx from "clsx";
import { TrendingUp } from "lucide-react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

/** Manual Trade is the only tab exposed in Add Trade modal chrome.
 * Daily Journal / CSV / Connect Broker stay available via openModal(...) from the Add Trades flow. */
const TABS = [{ id: "manual" as const, label: "Manual Trade", icon: TrendingUp }];

export function TradeTabs() {
  const { tab } = useAddTradeModal();

  // Hide chrome when the modal was opened directly to csv/broker/journal (flow handoff).
  if (tab !== "manual") return null;

  return (
    <div className="flex shrink-0 border-b border-white/[0.06]">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={clsx(
              "-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-zinc-500"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
