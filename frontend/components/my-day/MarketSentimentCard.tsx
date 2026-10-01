"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

import { AgentOutput } from "@/components/agents/AgentOutput";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useAgentRuns, useRunAgent, useUpdateAgent, useUserAgents } from "@/lib/hooks/useAgents";
import type { DayPlan } from "@/lib/my-day";

export function MarketSentimentCard({
  plan,
  accountId,
  date,
  loading,
}: {
  plan?: DayPlan;
  accountId?: string;
  date: string;
  tradeCount: number;
  loading?: boolean;
}) {
  const toast = useToast();
  const agents = useUserAgents();
  const runs = useAgentRuns();
  const runAgent = useRunAgent();
  const update = useUpdateAgent();
  const agent = (agents.data ?? []).find((item) => item.template_key === "market_briefing");
  const latest = (runs.data ?? []).find(
    (run) => run.agent_name === "market_briefing" && (run.details?.date === date || run.output?.title?.includes(date))
  );
  const briefing = (plan?.briefing || "").trim();

  async function generate() {
    if (!agent || !accountId) return;
    try {
      const result = await runAgent.mutateAsync({
        id: agent.id,
        trigger: "start_my_day",
        account_id: accountId,
        date,
      });
      if (result.status === "failed") toast.error(result.error || "Briefing failed");
      else toast.success("Briefing saved for this day");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t run the briefing");
    }
  }

  async function enable() {
    if (!agent) return;
    try {
      await update.mutateAsync({ id: agent.id, body: { status: "active", trigger_types: Array.from(new Set([...(agent.trigger_types || []), "start_my_day", "manual"])) } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t enable the agent");
    }
  }

  return (
    <section className="dash-card flex h-full min-h-[160px] flex-col p-4">
      <div className="mb-3 flex h-11 shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary-very-light)] text-primary">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">Market Sentiment Briefing</h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">This day</p>
          </div>
        </div>
        {agent?.status === "active" ? (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!accountId || runAgent.isPending}
            className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium hover:bg-[var(--color-primary-very-light)] disabled:opacity-60"
          >
            {runAgent.isPending ? "Reading headlines and your day plan…" : "Generate"}
          </button>
        ) : null}
      </div>
      {loading || agents.isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
      ) : !agent ? (
        <div className="text-[13px] leading-6 text-[var(--color-text-secondary)]">
          <p>Set up Market Sentiment Briefing to generate this from your symbols and day plan.</p>
          <Link href="/agents?create=market_briefing" className="mt-2 inline-flex text-[12px] font-semibold text-primary">
            Set Up Agent
          </Link>
        </div>
      ) : agent.status !== "active" ? (
        <div className="text-[13px] leading-6 text-[var(--color-text-secondary)]">
          <p>Market Sentiment Briefing is paused.</p>
          <button type="button" onClick={() => void enable()} className="mt-2 text-[12px] font-semibold text-primary">
            Enable Agent
          </button>
        </div>
      ) : briefing ? (
        <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--color-text-secondary)]">{briefing}</p>
      ) : latest?.output ? (
        <AgentOutput output={latest.output} />
      ) : (
        <p className="text-[13px] text-[var(--color-text-tertiary)]">No briefing for this day yet.</p>
      )}
    </section>
  );
}
