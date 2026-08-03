"use client";

import { FormEvent, useState } from "react";

import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAddWatchlistItem, useDeleteWatchlistItem, useWatchlist } from "@/lib/hooks/useWatchlist";

export default function AccountsSettingsPage() {
  const { data: watchlist } = useWatchlist();
  const addWatchlistItem = useAddWatchlistItem();
  const deleteWatchlistItem = useDeleteWatchlistItem();
  const [symbol, setSymbol] = useState("");

  function handleAddSymbol(e: FormEvent) {
    e.preventDefault();
    if (!symbol.trim()) return;
    addWatchlistItem.mutate({ symbol: symbol.trim() });
    setSymbol("");
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Accounts"
        subtitle="Portfolios, brokers, and symbols that feed your journal."
      />

      <div className="space-y-5">
        <SettingsCard title="Default Portfolio" description="Trades are logged to this portfolio by default.">
          <div className="rounded-lg border border-white/10 bg-black px-4 py-3">
            <div className="text-sm font-medium text-white">Default Portfolio</div>
            <div className="mt-0.5 text-xs text-zinc-500">Main Account · Active</div>
          </div>
        </SettingsCard>

        <SettingsCard title="Watchlist" description="Feeds Morning Brief and Daily Intelligence.">
          <form onSubmit={handleAddSymbol} className="mb-4 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SettingsField label="Symbol">
                <SettingsInput
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="Add symbol (e.g. NVDA)"
                />
              </SettingsField>
            </div>
            <Button type="submit" size="sm" disabled={addWatchlistItem.isPending} className="mb-0.5">
              Add
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {(watchlist ?? []).map((item) => (
              <button key={item.id} type="button" onClick={() => deleteWatchlistItem.mutate(item.id)} title="Remove">
                <Badge tone="gold">{item.symbol} ×</Badge>
              </button>
            ))}
            {(watchlist?.length ?? 0) === 0 && <p className="text-sm text-zinc-500">No symbols yet.</p>}
          </div>
        </SettingsCard>
      </div>
    </SettingsShell>
  );
}
