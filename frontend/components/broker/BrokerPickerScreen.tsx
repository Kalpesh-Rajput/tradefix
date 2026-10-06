"use client";

import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { BrokerMark } from "@/components/broker/BrokerMark";
import { Button } from "@/components/ui/Button";
import {
  categoryLabel,
  filterProviders,
  orderedCategories,
  type BrokerProvider,
} from "@/lib/brokers/provider";

interface BrokerPickerScreenProps {
  providers: BrokerProvider[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  selectedId: string | null;
  onSelect: (provider: BrokerProvider) => void;
  onContinue: () => void;
}

export function BrokerPickerScreen({
  providers,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onContinue,
}: BrokerPickerScreenProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => orderedCategories(providers), [providers]);
  const searching = query.trim().length > 0 || category !== "all";
  const matches = useMemo(
    () => filterProviders(providers, query, category),
    [providers, query, category]
  );
  const popular = useMemo(
    () => providers.filter((provider) => provider.popular),
    [providers]
  );
  const list = searching ? matches : popular;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col rounded-[28px] bg-[radial-gradient(ellipse_at_top,var(--color-primary-very-light),transparent_62%)] px-1 py-2 sm:px-4">
      <div className="text-center">
        <h2 className="text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-4xl">
          Choose Broker or Platform
        </h2>
        <p className="mt-2 text-sm text-muted sm:text-base">
          Select your platform to configure its import settings.
        </p>
      </div>

      <div className="relative mt-8">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search brokers, platforms or prop firms"
          aria-label="Search brokers, platforms or prop firms"
          className="h-12 w-full rounded-2xl border border-border bg-surface pl-11 pr-4 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {categories.length > 0 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Broker categories">
          <CategoryChip label="All" active={category === "all"} onClick={() => setCategory("all")} />
          {categories.map((item) => (
            <CategoryChip
              key={item}
              label={categoryLabel(item)}
              active={category === item}
              onClick={() => setCategory(item)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted">Loading brokers...</p>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-foreground">Unable to load brokers</p>
            {onRetry ? (
              <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : providers.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted">No brokers available</p>
        ) : (
          <>
            <h3 className="text-left text-base font-semibold text-foreground">
              {searching ? "Results" : "Popular Brokers"}
            </h3>
            {list.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-sm font-medium text-foreground">No brokers or platforms found</p>
                <p className="mt-1 text-sm text-muted">Try searching by broker name, platform or category.</p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" role="listbox" aria-label="Brokers">
                {list.map((provider) => {
                  const selected = selectedId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => onSelect(provider)}
                      className={clsx(
                        "flex h-[4.25rem] items-center gap-3 rounded-2xl border bg-surface px-4 text-left shadow-sm transition",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        selected
                          ? "border-primary bg-primary/[0.06] shadow-md"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <BrokerMark provider={provider} size={36} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {provider.display_name}
                      </span>
                      {selected ? (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" aria-hidden />
                          <span className="sr-only">Selected</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8">
        <Button
          type="button"
          size="lg"
          className="h-12 w-full rounded-2xl text-base"
          disabled={!selectedId}
          onClick={onContinue}
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
