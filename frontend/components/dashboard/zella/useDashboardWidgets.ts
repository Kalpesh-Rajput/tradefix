"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tradefix_dashboard_widgets";

export type DashboardWidgetId =
  | "metrics"
  | "score"
  | "cumulative"
  | "daily"
  | "positions"
  | "calendar"
  | "accountBalance"
  | "drawdown"
  | "tradeTime"
  | "tradeDuration"
  | "progress"
  | "marketSessions";

export type DashboardWidgetConfig = Record<DashboardWidgetId, boolean>;

export const DEFAULT_WIDGETS: DashboardWidgetConfig = {
  metrics: true,
  score: true,
  cumulative: true,
  daily: true,
  positions: true,
  calendar: true,
  accountBalance: true,
  drawdown: true,
  tradeTime: true,
  tradeDuration: true,
  progress: true,
  marketSessions: true,
};

const LABELS: Record<DashboardWidgetId, string> = {
  metrics: "Summary metrics",
  score: "TradeFix Score",
  cumulative: "Cumulative P&L",
  daily: "Net Daily P&L",
  positions: "Positions / Recent trades",
  calendar: "Calendar",
  accountBalance: "Account balance",
  drawdown: "Drawdown",
  tradeTime: "Trade time performance",
  tradeDuration: "Trade duration performance",
  progress: "Progress tracker",
  marketSessions: "Market sessions",
};

export function useDashboardWidgets() {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig>(DEFAULT_WIDGETS);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DashboardWidgetConfig>;
      setWidgets({ ...DEFAULT_WIDGETS, ...parsed });
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: DashboardWidgetConfig) {
    setWidgets(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function toggle(id: DashboardWidgetId) {
    persist({ ...widgets, [id]: !widgets[id] });
  }

  return { widgets, editing, setEditing, toggle, labels: LABELS };
}
