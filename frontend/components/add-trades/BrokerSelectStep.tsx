"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { BrokerIcon } from "@/components/ui/BrokerIcon";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  filterUnifiedBrokers,
  popularUnifiedBrokers,
  type UnifiedBroker,
} from "@/lib/brokers/unified-catalog";

interface BrokerSelectStepProps {
  brokers: UnifiedBroker[];
  selected: UnifiedBroker | null;
  selectedServer: string | null;
  onSelect: (broker: UnifiedBroker | null) => void;
  onSelectServer: (server: string) => void;
  onContinue: () => void;
  catalogLoading?: boolean;
}

export function BrokerSelectStep({
  brokers,
  selected,
  selectedServer,
  onSelect,
  onSelectServer,
  onContinue,
  catalogLoading,
}: BrokerSelectStepProps) {
  const [query, setQuery] = useState("");
  const [serverQuery, setServerQuery] = useState("");

  const filtered = useMemo(() => filterUnifiedBrokers(brokers, query), [brokers, query]);
  const popular = useMemo(() => popularUnifiedBrokers(brokers, 12), [brokers]);
  const showPopular = !query.trim();
  const list = showPopular ? popular : filtered;
  const servers = selected?.servers ?? [];
  const needsServer = servers.length > 0;
  const visibleServers = useMemo(() => {
    const q = serverQuery.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((server) => server.toLowerCase().includes(q));
  }, [servers, serverQuery]);

  const canContinue = Boolean(selected) && (!needsServer || Boolean(selectedServer));

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-1">
      <div className="shrink-0 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Choose Broker, Prop Firm
          <br className="hidden sm:block" /> or Trading Platform
        </h2>
      </div>

      <div className="relative mt-6 shrink-0">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing the broker, prop firm or trading platform"
          className="pr-10"
          aria-label="Search brokers"
        />
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
        <p className="mb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">
          {selected && needsServer
            ? "Selected platform"
            : showPopular
              ? "Popular Brokers"
              : `Results (${filtered.length})`}
        </p>

        {catalogLoading && brokers.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Loading brokers…</p>
        ) : selected && needsServer ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setServerQuery("");
              }}
              className="flex w-full items-center gap-3 rounded-xl border border-primary bg-primary/10 px-3.5 py-3 text-left ring-1 ring-primary/30"
            >
              <BrokerIcon name={selected.name} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{selected.name}</span>
                <span className="text-[11px] text-muted">
                  {selected.autoSyncAvailable ? "Auto-sync available · " : ""}
                  {selected.servers.length} servers
                </span>
              </span>
              <span className="text-xs font-medium text-primary">Change</span>
            </button>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Select {selected.name} server</p>
              <p className="mt-1 text-xs text-muted">
                Pick the broker or trade server you use in {selected.name}. Next you will enter login,
                investor password, and the exact server name to sync trades.
              </p>
              <div className="relative mt-3">
                <Input
                  value={serverQuery}
                  onChange={(e) => setServerQuery(e.target.value)}
                  placeholder="Search servers…"
                  className="pr-10"
                  aria-label="Search servers"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border">
                {visibleServers.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">No servers match.</p>
                ) : (
                  visibleServers.map((server) => {
                    const active = selectedServer === server;
                    return (
                      <button
                        key={server}
                        type="button"
                        onClick={() => onSelectServer(server)}
                        className={clsx(
                          "flex w-full items-center justify-between border-b border-border/60 px-3 py-2.5 text-left text-sm last:border-b-0",
                          active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground hover:bg-foreground/[0.03]"
                        )}
                      >
                        {server}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No brokers match your search.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {list.map((broker) => (
              <button
                key={broker.id}
                type="button"
                onClick={() => {
                  onSelect(broker);
                  setServerQuery("");
                }}
                className={clsx(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                  selected?.id === broker.id
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border bg-card hover:border-primary/30 hover:bg-foreground/[0.02]"
                )}
              >
                <BrokerIcon name={broker.name} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{broker.name}</span>
                  {broker.autoSyncAvailable ? (
                    <span className="text-[11px] text-positive">Auto-sync available</span>
                  ) : broker.servers.length > 0 ? (
                    <span className="text-[11px] text-muted">{broker.servers.length} servers</span>
                  ) : (
                    <span className="text-[11px] text-muted">File / manual</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

        {showPopular && !selected && filtered.length > popular.length ? (
          <p className="mt-4 text-center text-xs text-muted">
            Search to find more of {brokers.length} brokers and platforms.
          </p>
        ) : null}
      </div>

      <div className="mt-6 shrink-0">
        <Button type="button" size="lg" className="w-full" disabled={!canContinue} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
