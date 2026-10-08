"use client";

import clsx from "clsx";
import { CalendarDays, ChevronDown, Coins, Star, Tag, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ASSET_OPTIONS } from "@/components/trade/schema";
import { moodsFromTrade } from "@/lib/masters";
import type { Trade } from "@/lib/types";
import {
  DEFAULT_FILTERS,
  pickAdvanced,
  uniqueLabels,
  type AdvancedFilterValue,
  type LocalFilters,
} from "@/lib/trades/logFilters";

type TabId = "popular" | "price" | "performance" | "time" | "tags";

const TABS: { id: TabId; label: string; icon: typeof Star }[] = [
  { id: "popular", label: "Popular", icon: Star },
  { id: "price", label: "Price/Quantity", icon: Coins },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "time", label: "Days/Time", icon: CalendarDays },
  { id: "tags", label: "Tags/Strategy", icon: Tag },
];

const WEEKDAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-semibold text-[var(--color-text-primary)]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={clsx(
            "h-11 w-full appearance-none rounded-xl border border-[#E4E4E9] bg-white px-3 pr-9 text-[13px] outline-none transition focus:border-primary/40",
            value ? "text-[var(--color-text-primary)]" : "text-[#A1A1AA]"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]" />
      </div>
    </label>
  );
}

function withCurrent(options: { value: string; label: string }[], current: string) {
  if (!current || options.some((option) => option.value === current)) return options;
  return [...options, { value: current, label: current }];
}

export function AdvancedFilterDialog({
  open,
  filters,
  trades,
  onClose,
  onApply,
}: {
  open: boolean;
  filters: LocalFilters;
  trades: Trade[];
  onClose: () => void;
  onApply: (value: AdvancedFilterValue) => void;
}) {
  const [tab, setTab] = useState<TabId>("popular");
  const [draft, setDraft] = useState<AdvancedFilterValue>(() => pickAdvanced(filters));

  useEffect(() => {
    if (!open) return;
    setDraft(pickAdvanced(filters));
    setTab("popular");
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const options = useMemo(() => {
    return {
      tickers: uniqueLabels(trades.map((trade) => trade.symbol)).map((value) => ({ value, label: value })),
      strategies: uniqueLabels(
        trades.flatMap((trade) => [trade.setup_tag, trade.strategy_name, ...(trade.setup_tags ?? [])])
      ).map((value) => ({ value, label: value })),
      sessions: uniqueLabels(trades.map((trade) => trade.session)).map((value) => ({ value, label: value })),
      moods: uniqueLabels(trades.flatMap((trade) => moodsFromTrade(trade))).map((value) => ({ value, label: value })),
      emotions: uniqueLabels(trades.flatMap((trade) => trade.emotion_tags ?? [])).map((value) => ({
        value,
        label: value,
      })),
    };
  }, [trades]);

  if (!open) return null;

  function set<K extends keyof AdvancedFilterValue>(key: K, value: AdvancedFilterValue[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const cleared = pickAdvanced(DEFAULT_FILTERS);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/25 backdrop-blur-[6px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="advance-filter-title"
        className="relative z-10 flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <h2 id="advance-filter-title" className="text-[16px] font-semibold text-[var(--color-text-primary)]">
            Advance Filter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-tertiary)] hover:bg-[#F4F4F6] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-5">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={clsx(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-[#F3F3F6] text-[var(--color-text-primary)] hover:bg-[#EAEAED]"
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="min-h-[240px] flex-1 overflow-y-auto px-5 py-5">
          {tab === "popular" ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <FilterSelect
                label="Ticker"
                value={draft.symbol}
                placeholder="Choose ticker"
                options={withCurrent(options.tickers, draft.symbol)}
                onChange={(value) => set("symbol", value)}
              />
              <FilterSelect
                label="Status"
                value={draft.status === "all" ? "" : draft.status}
                placeholder="Open/Closed"
                options={[
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                ]}
                onChange={(value) => set("status", value === "open" || value === "closed" ? value : "all")}
              />
              <FilterSelect
                label="Side"
                value={draft.side}
                placeholder="Long/Short"
                options={[
                  { value: "long", label: "Long" },
                  { value: "short", label: "Short" },
                ]}
                onChange={(value) => set("side", value === "long" || value === "short" ? value : "")}
              />
              <FilterSelect
                label="Class"
                value={draft.asset_type}
                placeholder="Choose class"
                options={ASSET_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                onChange={(value) => set("asset_type", value as AdvancedFilterValue["asset_type"])}
              />
              <FilterSelect
                label="Holding"
                value={draft.holding}
                placeholder="Intraday/Multiday"
                options={[
                  { value: "intraday", label: "Intraday" },
                  { value: "multiday", label: "Multiday" },
                ]}
                onChange={(value) => set("holding", value === "intraday" || value === "multiday" ? value : "")}
              />
            </div>
          ) : null}

          {tab === "price" ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <FilterSelect
                label="P&L"
                value={draft.pnl}
                placeholder="Choose P&L"
                options={[
                  { value: "profit", label: "Profit" },
                  { value: "loss", label: "Loss" },
                  { value: "breakeven", label: "Breakeven" },
                ]}
                onChange={(value) =>
                  set("pnl", value === "profit" || value === "loss" || value === "breakeven" ? value : "")
                }
              />
              <FilterSelect
                label="Fees"
                value={draft.fees}
                placeholder="Choose fees"
                options={[
                  { value: "with", label: "With fees" },
                  { value: "without", label: "No fees" },
                ]}
                onChange={(value) => set("fees", value === "with" || value === "without" ? value : "")}
              />
              <FilterSelect
                label="Trade Risk"
                value={draft.risk}
                placeholder="Choose risk"
                options={[
                  { value: "with", label: "With risk" },
                  { value: "without", label: "No risk" },
                ]}
                onChange={(value) => set("risk", value === "with" || value === "without" ? value : "")}
              />
            </div>
          ) : null}

          {tab === "performance" ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <FilterSelect
                label="Net ROI"
                value={draft.roi}
                placeholder="Choose return"
                options={[
                  { value: "positive", label: "Positive" },
                  { value: "negative", label: "Negative" },
                ]}
                onChange={(value) => set("roi", value === "positive" || value === "negative" ? value : "")}
              />
              <FilterSelect
                label="Trade Rating"
                value={draft.rating}
                placeholder="Choose rating"
                options={[
                  { value: "5", label: "5" },
                  { value: "4", label: "4" },
                  { value: "3", label: "3" },
                  { value: "2", label: "2" },
                  { value: "1", label: "1" },
                  { value: "unrated", label: "Unrated" },
                ]}
                onChange={(value) => set("rating", value as AdvancedFilterValue["rating"])}
              />
              <FilterSelect
                label="Realized R-Multiple"
                value={draft.r_multiple}
                placeholder="Choose R"
                options={[
                  { value: "positive", label: "Positive" },
                  { value: "negative", label: "Negative" },
                  { value: "none", label: "None" },
                ]}
                onChange={(value) =>
                  set(
                    "r_multiple",
                    value === "positive" || value === "negative" || value === "none" ? value : ""
                  )
                }
              />
            </div>
          ) : null}

          {tab === "time" ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <FilterSelect
                label="Session"
                value={draft.session}
                placeholder="Choose session"
                options={withCurrent(options.sessions, draft.session)}
                onChange={(value) => set("session", value)}
              />
              <FilterSelect
                label="Weekday"
                value={draft.weekday}
                placeholder="Choose day"
                options={WEEKDAYS}
                onChange={(value) => set("weekday", value as AdvancedFilterValue["weekday"])}
              />
              <FilterSelect
                label="Holding"
                value={draft.holding}
                placeholder="Intraday/Multiday"
                options={[
                  { value: "intraday", label: "Intraday" },
                  { value: "multiday", label: "Multiday" },
                ]}
                onChange={(value) => set("holding", value === "intraday" || value === "multiday" ? value : "")}
              />
            </div>
          ) : null}

          {tab === "tags" ? (
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <FilterSelect
                label="Strategy"
                value={draft.setup_tag}
                placeholder="Choose strategy"
                options={withCurrent(options.strategies, draft.setup_tag)}
                onChange={(value) => set("setup_tag", value)}
              />
              <FilterSelect
                label="Mood"
                value={draft.mood}
                placeholder="Choose mood"
                options={withCurrent(options.moods, draft.mood)}
                onChange={(value) => set("mood", value)}
              />
              <FilterSelect
                label="Emotion"
                value={draft.emotion}
                placeholder="Choose emotion"
                options={withCurrent(options.emotions, draft.emotion)}
                onChange={(value) => set("emotion", value)}
              />
              <FilterSelect
                label="Rules"
                value={draft.rules}
                placeholder="Choose rules"
                options={[
                  { value: "broken", label: "Rules broken" },
                  { value: "clean", label: "No rules broken" },
                ]}
                onChange={(value) => set("rules", value === "broken" || value === "clean" ? value : "")}
              />
              <FilterSelect
                label="Notes"
                value={draft.journal}
                placeholder="Journaled/Unjournaled"
                options={[
                  { value: "journaled", label: "Journaled" },
                  { value: "unjournaled", label: "Unjournaled" },
                ]}
                onChange={(value) => set("journal", value === "journaled" || value === "unjournaled" ? value : "")}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#EFEFF2] px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft(cleared)}
            className="text-[13px] font-medium text-primary hover:underline"
          >
            Reset all
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-[#E4E4E9] bg-white px-4 text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[#F7F7F9]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-medium text-white hover:bg-[var(--color-primary-hover)]"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
