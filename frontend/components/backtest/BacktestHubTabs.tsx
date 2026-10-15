"use client";

import { useState } from "react";

import { SessionsList } from "@/components/backtest/session/SessionsList";
import { StrategiesList } from "@/components/backtest/strategy/StrategiesList";
import { SetupLabTab } from "@/components/backtest/SetupLabTab";

const TABS = [
  { id: "sessions", label: "Manual Sessions" },
  { id: "strategies", label: "Strategies" },
  { id: "runs", label: "Runs" },
  { id: "setup", label: "Setup Lab" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BacktestHubTabs() {
  const [tab, setTab] = useState<TabId>("sessions");

  return (
    <div className="space-y-4">
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
        {tab === "runs" ? <EmptyPanel title="No backtest runs yet" body="Finished and running backtests will be listed here." /> : null}
        {tab === "setup" ? <SetupLabTab /> : null}
      </div>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="dash-card px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  );
}
