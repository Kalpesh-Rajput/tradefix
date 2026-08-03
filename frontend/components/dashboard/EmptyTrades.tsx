"use client";

import { Plus } from "lucide-react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

export function EmptyTrades() {
  const { openModal } = useAddTradeModal();

  return (
    <button
      type="button"
      onClick={() => openModal("manual")}
      className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-zinc-700 px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 transition-colors group-hover:bg-primary/10">
        <Plus className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover:text-primary" />
      </span>
      <span className="text-sm text-zinc-500 transition-colors group-hover:text-zinc-300">
        No trades logged today — add your first
      </span>
    </button>
  );
}
