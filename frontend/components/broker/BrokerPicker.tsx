"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { BarChart3, Bitcoin, ChevronRight, Layers, Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { BrokerIcon } from "@/components/ui/BrokerIcon";
import { Input } from "@/components/ui/Input";
import {
  BROKER_CATEGORIES,
  brokerCategoryId,
  filterBrokers,
  groupBrokersByCategory,
  type BrokerCategoryId,
} from "@/lib/connectors/broker-categories";
import type { BrokerCatalogItem } from "@/lib/connectors/types";

const CATEGORY_ICON: Record<BrokerCategoryId, typeof TrendingUp> = {
  forex: TrendingUp,
  crypto: Bitcoin,
  futures: BarChart3,
  other: Layers,
};

const CATEGORY_ACCENT: Record<BrokerCategoryId, string> = {
  forex: "from-emerald-500/15 to-transparent border-emerald-500/30",
  crypto: "from-amber-500/15 to-transparent border-amber-500/30",
  futures: "from-sky-500/15 to-transparent border-sky-500/30",
  other: "from-violet-500/15 to-transparent border-violet-500/30",
};

const CATEGORY_DOT: Record<BrokerCategoryId, string> = {
  forex: "bg-emerald-400",
  crypto: "bg-amber-400",
  futures: "bg-sky-400",
  other: "bg-violet-400",
};

interface BrokerPickerProps {
  brokers: BrokerCatalogItem[];
  disabled?: boolean;
  compact?: boolean;
  onSelect: (broker: BrokerCatalogItem) => void;
  className?: string;
}

export function BrokerPicker({ brokers, disabled, compact = false, onSelect, className }: BrokerPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<BrokerCategoryId | "all">("all");

  const filtered = useMemo(() => filterBrokers(brokers, query), [brokers, query]);
  const grouped = useMemo(() => groupBrokersByCategory(filtered), [filtered]);

  const visibleCategories = useMemo(() => {
    return BROKER_CATEGORIES.filter((cat) => {
      const items = grouped.get(cat.id) ?? [];
      if (items.length === 0) return false;
      if (activeCategory === "all") return true;
      return cat.id === activeCategory;
    });
  }, [grouped, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filtered.length };
    for (const cat of BROKER_CATEGORIES) {
      counts[cat.id] = grouped.get(cat.id)?.length ?? 0;
    }
    return counts;
  }, [filtered.length, grouped]);

  const gridClass = compact
    ? "grid grid-cols-2 gap-2.5"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <div className={clsx("space-y-6", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brokers…"
          className="pl-9"
          aria-label="Search brokers"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <CategoryChip
          label="All"
          count={categoryCounts.all}
          active={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
        />
        {BROKER_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.id] ?? 0;
          if (count === 0) return null;
          const Icon = CATEGORY_ICON[cat.id];
          return (
            <CategoryChip
              key={cat.id}
              label={cat.label}
              count={count}
              active={activeCategory === cat.id}
              icon={<Icon className="h-3.5 w-3.5" />}
              dotClass={CATEGORY_DOT[cat.id]}
              onClick={() => setActiveCategory(cat.id)}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted">
          No brokers match &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div className={compact ? "space-y-6" : "space-y-8"}>
          {visibleCategories.map((category) => {
            const items = grouped.get(category.id) ?? [];
            if (items.length === 0) return null;
            const Icon = CATEGORY_ICON[category.id];

            return (
              <section key={category.id} aria-labelledby={`broker-cat-${category.id}`}>
                <div className={clsx("flex items-start gap-3", compact ? "mb-3" : "mb-4")}>
                  <div
                    className={clsx(
                      "flex shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br",
                      compact ? "h-8 w-8" : "h-10 w-10",
                      CATEGORY_ACCENT[category.id]
                    )}
                  >
                    <Icon className={compact ? "h-4 w-4 text-foreground" : "h-5 w-5 text-foreground"} />
                  </div>
                  <div className="min-w-0">
                    <h4
                      id={`broker-cat-${category.id}`}
                      className={clsx("font-semibold text-foreground", compact ? "text-sm" : "text-base")}
                    >
                      {category.label}
                    </h4>
                    <p className={clsx("mt-0.5 leading-relaxed text-muted", compact ? "text-xs" : "text-sm")}>
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className={gridClass}>
                  {items.map((broker, index) => (
                    <BrokerCard
                      key={broker.id}
                      broker={broker}
                      categoryId={category.id}
                      index={index}
                      compact={compact}
                      disabled={disabled}
                      onSelect={() => onSelect(broker)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
  icon,
  dotClass,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-surface/50 text-muted hover:border-primary/30 hover:text-foreground"
      )}
    >
      {dotClass && !active && <span className={clsx("h-2 w-2 rounded-full", dotClass)} />}
      {icon}
      {label}
      <span className={clsx("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-primary/20" : "bg-foreground/5")}>
        {count}
      </span>
    </button>
  );
}

function brokerPlatformLabel(broker: BrokerCatalogItem): string {
  if (broker.kind === "mt5") return "MetaTrader 5";
  return "Exchange API";
}

function BrokerCard({
  broker,
  categoryId,
  index,
  compact,
  disabled,
  onSelect,
}: {
  broker: BrokerCatalogItem;
  categoryId: BrokerCategoryId;
  index: number;
  compact?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      onClick={onSelect}
      className={clsx(
        "group relative flex min-w-0 items-center gap-3 rounded-xl border text-left transition",
        "border-border bg-surface hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.35)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        compact ? "p-3" : "w-full p-4"
      )}
    >
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition group-hover:opacity-100",
          CATEGORY_ACCENT[categoryId]
        )}
      />

      <div
        className={clsx(
          "relative flex shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-border/70",
          compact ? "h-10 w-10" : "h-12 w-12"
        )}
      >
        <BrokerIcon name={broker.name} size={compact ? 24 : 32} />
      </div>

      <div className="relative min-w-0 flex-1 space-y-0.5">
        <p
          className={clsx(
            "truncate font-semibold leading-snug text-foreground group-hover:text-primary",
            compact ? "text-sm" : "text-[15px]"
          )}
        >
          {broker.name}
        </p>
        <p className={clsx("truncate text-muted", compact ? "text-[11px]" : "text-xs leading-relaxed")}>
          {brokerPlatformLabel(broker)} · read-only sync
        </p>
      </div>

      <ChevronRight className="relative h-4 w-4 shrink-0 text-muted opacity-40 transition group-hover:opacity-100 group-hover:text-primary" />
    </motion.button>
  );
}

export function brokerCategoryLabel(brokerId: string): string {
  const id = brokerCategoryId(brokerId);
  return BROKER_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}
