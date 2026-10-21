"use client";

import { Activity, FlaskConical, Layers, Play, type LucideIcon } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

import { RunsList } from "@/components/backtest/results/RunsList";
import { SessionsList } from "@/components/backtest/session/SessionsList";
import { SetupLabTab } from "@/components/backtest/SetupLabTab";
import { StrategiesList } from "@/components/backtest/strategy/StrategiesList";
import { useBacktestRuns } from "@/lib/hooks/useBacktestRuns";
import { useBacktestSessions } from "@/lib/hooks/useBacktestSessions";
import { useStrategies } from "@/lib/hooks/useStrategies";

const TABS = [
  {
    id: "sessions",
    label: "Manual sessions",
    title: "Trade it yourself",
    detail: "Play EUR/USD or EUR/CHF forward and place orders on the next candle.",
    icon: Play,
  },
  {
    id: "strategies",
    label: "Strategies",
    title: "Save a ruleset",
    detail: "Templates default to EUR/USD, 16 March–1 April 2026, on 15-minute bars.",
    icon: Layers,
  },
  {
    id: "runs",
    label: "Runs",
    title: "Read the result",
    detail: "Equity, drawdown, and each simulated trade from a finished job.",
    icon: Activity,
  },
  {
    id: "setup",
    label: "Setup Lab",
    title: "Journal expectancy",
    detail: "Win rate and expectancy from the setup tags on your live trades.",
    icon: FlaskConical,
  },
] as const satisfies readonly { id: string; label: string; title: string; detail: string; icon: LucideIcon }[];

type TabId = (typeof TABS)[number]["id"];

export function BacktestHubTabs() {
  const [tab, setTab] = useState<TabId>("sessions");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sessions = useBacktestSessions();
  const runs = useBacktestRuns();
  const strategies = useStrategies();

  const counts: Partial<Record<TabId, number | undefined>> = {
    sessions: sessions.data?.length,
    strategies: strategies.data?.length,
    runs: runs.data?.length,
  };

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Backtesting" onKeyDown={onKeyDown} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TABS.map((item) => {
          const selected = tab === item.id;
          const Icon = item.icon;
          const count = counts[item.id];
          return (
            <button
              key={item.id}
              ref={(node) => {
                refs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`backtest-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`backtest-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`group relative overflow-hidden rounded-xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none ${
                selected
                  ? "border-primary/50 bg-card shadow-[0_14px_32px_-18px_hsl(var(--primary)/0.55)]"
                  : "border-border bg-surface hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift motion-reduce:hover:translate-y-0"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/0 via-primary to-primary/0 transition-opacity ${selected ? "opacity-100" : "opacity-0"}`}
              />
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    selected ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-primary/5 text-primary group-hover:bg-primary/10"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                </span>
                {count !== undefined ? (
                  <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted">
                    {count}
                  </span>
                ) : null}
              </span>
              <span className="mt-3 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{item.label}</span>
              <span className="mt-0.5 block text-[15px] font-semibold tracking-tight text-foreground">{item.title}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{item.detail}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`backtest-panel-${tab}`} aria-labelledby={`backtest-tab-${tab}`} tabIndex={0} className="focus-visible:outline-none">
        {tab === "sessions" ? <SessionsList /> : null}
        {tab === "strategies" ? <StrategiesList /> : null}
        {tab === "runs" ? <RunsList /> : null}
        {tab === "setup" ? <SetupLabTab /> : null}
      </div>
    </div>
  );
}
