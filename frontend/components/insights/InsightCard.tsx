"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { Badge } from "@/components/ui/Badge";
import { Insight } from "@/lib/types";

const AGENT_LABELS: Record<string, string> = {
  morning_brief: "Morning Brief",
  pattern_scout: "Pattern Scout",
  risk_contribution: "Risk Contribution",
  hot_take: "Hot Take",
  journal_pulse: "Journal Pulse",
};

const TYPE_LABELS: Record<string, string> = {
  TIME_EDGE: "Time Edge",
  STREAK_ALERT: "Streak Alert",
  SETUP_WIN: "Setup Win",
  SETUP_DECAY: "Setup Decay",
};

function severityTone(severity: string) {
  if (severity === "positive") return "positive" as const;
  if (severity === "warning" || severity === "critical") return "warning" as const;
  return "gold" as const;
}

export function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss?: (id: string) => void }) {
  const { formatDateTime } = useLocale();
  const label = insight.agent_name
    ? AGENT_LABELS[insight.agent_name] ?? insight.agent_name
    : TYPE_LABELS[insight.type] ?? insight.type;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={severityTone(insight.severity)}>{label}</Badge>
          <span className="text-xs text-gray-500">{formatDateTime(insight.created_at)}</span>
        </div>
        {onDismiss && (
          <button onClick={() => onDismiss(insight.id)} className="text-xs text-gray-500 hover:text-white">
            Dismiss
          </button>
        )}
      </div>
      <h4 className="mt-2 text-sm font-semibold text-white">{insight.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-gray-300">{insight.body}</p>
    </div>
  );
}
