"use client";

import { InsightCard } from "@/components/insights/InsightCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAgentInsights, useAgentList, useAgentRuns, useRunAgent } from "@/lib/hooks/useAgents";

const AGENT_META: Record<string, { label: string; cadence: string; description: string }> = {
  morning_brief: {
    label: "Morning Brief",
    cadence: "Daily · Pre-market",
    description: "Scans your watchlist, open positions, and recent stats to deliver a sharp pre-session rundown.",
  },
  pattern_scout: {
    label: "Pattern Scout",
    cadence: "Daily · Setups",
    description: "Finds which of your tagged setups is trending up in win rate right now.",
  },
  risk_contribution: {
    label: "Risk Contribution",
    cadence: "Daily · Risk",
    description: "Flags position concentration and drawdown risk before it becomes a problem.",
  },
  hot_take: {
    label: "Hot Take",
    cadence: "Weekly · Thesis",
    description: "One bold, data-backed trading thesis based on your own performance trends.",
  },
  journal_pulse: {
    label: "Journal Pulse",
    cadence: "Daily · Mindset",
    description: "Reads your mood check-ins and notes to surface how mental state correlates with P&L.",
  },
};

export default function AgentsPage() {
  const { data: agentNames } = useAgentList();
  const { data: insights, isLoading } = useAgentInsights();
  const { data: runs } = useAgentRuns();
  const runAgent = useRunAgent();

  const lastRunByAgent = new Map((runs ?? []).map((r) => [r.agent_name, r]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Agents Inbox</h1>
        <p className="mt-1 text-sm text-gray-400">
          5 AI agents, one inbox, always working — powered by OpenRouter. Add an OpenRouter API key in your backend{" "}
          <code className="text-gold">.env</code> to enable them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(agentNames ?? Object.keys(AGENT_META)).map((name) => {
          const meta = AGENT_META[name] ?? { label: name, cadence: "", description: "" };
          const lastRun = lastRunByAgent.get(name);
          return (
            <Card key={name}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
                  <p className="text-xs text-gray-500">{meta.cadence}</p>
                </div>
                {lastRun && (
                  <Badge tone={lastRun.status === "success" ? "positive" : lastRun.status === "failed" ? "negative" : "neutral"}>
                    {lastRun.status}
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-400">{meta.description}</p>
              {lastRun?.message && <p className="mt-2 text-xs text-gray-500">{lastRun.message}</p>}
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => runAgent.mutate(name)}
                disabled={runAgent.isPending}
              >
                {runAgent.isPending ? "Running…" : "Run now"}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Agent feed" subtitle="Everything your agents have generated, newest first" />
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {!isLoading && (insights?.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-gray-500">
            No agent output yet. Click "Run now" on any agent above to generate one.
          </div>
        )}
        <div className="space-y-3">
          {insights?.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </Card>
    </div>
  );
}
