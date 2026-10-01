"use client";

import { Sparkles } from "lucide-react";

import { useAddTradeModal } from "@/components/trade/useAddTradeModal";

export function EmptyIntelligence({ tradesAnalysed = 0 }: { tradesAnalysed?: number }) {
  const { openFlow } = useAddTradeModal();

  return (
    <section className="dash-card px-5 py-10 text-center sm:px-8">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-very-light)] text-primary">
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 text-[18px] font-semibold text-[var(--color-text-primary)]">Not enough trading data yet</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[var(--color-text-secondary)]">
        TradeFix needs more trades to identify reliable patterns.
        {tradesAnalysed > 0 ? ` ${tradesAnalysed} closed trades are in this window.` : ""}
      </p>
      <button
        type="button"
        onClick={() => openFlow()}
        className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
      >
        Log a Trade
      </button>
    </section>
  );
}
