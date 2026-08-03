"use client";

import clsx from "clsx";
import { FileText, Link2, TrendingUp, Upload } from "lucide-react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

const TABS = [
  { id: "manual" as const, label: "Manual Trade", icon: TrendingUp },
  { id: "journal" as const, label: "Daily Journal", icon: FileText },
  { id: "csv" as const, label: "Import CSV", icon: Upload },
  { id: "broker" as const, label: "Connect Broker", icon: Link2 },
];

export function TradeTabs() {
  const { tab, setTab } = useAddTradeModal();

  return (
    <div className="flex shrink-0 border-b border-white/[0.06]">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs transition-colors",
              active ? "border-primary text-primary" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
