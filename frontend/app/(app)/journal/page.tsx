"use client";

import { useState } from "react";

import { CsvImportButton } from "@/components/trades/CsvImportDialog";
import { TradeFilters } from "@/components/trades/TradeFilters";
import { TradeTable } from "@/components/trades/TradeTable";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Button } from "@/components/ui/Button";
import { TradeFilters as Filters, useTrades } from "@/lib/hooks/useTrades";

export default function JournalPage() {
  const [filters, setFilters] = useState<Filters>({});
  const { data: trades, isLoading } = useTrades(filters);
  const { openModal } = useAddTradeModal();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Trade Log</h1>
          <p className="mt-1 text-sm text-muted">Every trade you&apos;ve logged, searchable and filterable.</p>
        </div>
        <div className="flex items-center gap-3">
          <CsvImportButton />
          <Button size="sm" onClick={() => openModal("manual")}>
            Add Trade
          </Button>
        </div>
      </div>

      <TradeFilters value={filters} onChange={setFilters} />

      {isLoading ? <p className="text-sm text-muted">Loading trades…</p> : <TradeTable trades={trades ?? []} />}
    </div>
  );
}
