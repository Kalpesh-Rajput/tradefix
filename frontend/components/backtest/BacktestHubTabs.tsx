"use client";

import { useState } from "react";

import { SessionsList } from "@/components/backtest/session/SessionsList";
import { RunsList } from "@/components/backtest/results/RunsList";
import { StrategiesList } from "@/components/backtest/strategy/StrategiesList";
import { SetupLabTab } from "@/components/backtest/SetupLabTab";

const TABS = [
  {
    id: "sessions",
    label: "Manual Sessions",
    title: "Trade it yourself",
    detail: "Play EUR/USD or EUR/CHF forward and place orders on the next candle.",
  },
  {
    id: "strategies",
    label: "Strategies",
    title: "Save a ruleset",
    detail: "Templates default to EUR/USD, 16 March–1 April 2026, on 15-minute bars.",
  },
  {
    id: "runs",
    label: "Runs",
    title: "Read the result",
    detail: "Equity, drawdown, and each simulated trade from a finished job.",
  },
  {
    id: "setup",
    label: "Setup Lab",
    title: "Journal expectancy",
    detail: "Win rate and expectancy from the setup tags on your live trades.",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BacktestHubTabs() {
  const [tab, setTab] = useState<TabId>("sessions");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={selected}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                selected ? "border-primary bg-card shadow-sm" : "border-border bg-surface hover:border-primary/40"
              }`}
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{item.label}</span>
              <span className="mt-1 block text-sm font-semibold text-foreground">{item.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{item.detail}</span>
            </button>
          );
        })}
      </div>

      <div role="tablist" aria-label="Backtesting" className="flex h-11 items-end gap-1 border-b border-border">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`backtest-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`backtest-panel-${item.id}`}
              className={`h-10 rounded-t-lg px-3 text-sm ${selected ? "border border-b-0 border-border bg-card font-medium text-foreground" : "text-muted hover:text-foreground"}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`backtest-panel-${tab}`} aria-labelledby={`backtest-tab-${tab}`}>
        {tab === "sessions" ? <SessionsList /> : null}
        {tab === "strategies" ? <StrategiesList /> : null}
        {tab === "runs" ? <RunsList /> : null}
        {tab === "setup" ? <SetupLabTab /> : null}
      </div>
    </div>
  );
}
