"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useAgentInsights, useRunAgent } from "@/lib/hooks/useAgents";
import { useSaveDayBriefing } from "@/lib/hooks/useDayPlan";
import type { DayPlan } from "@/lib/my-day";
import type { Insight } from "@/lib/types";

function isMorningBrief(insight: Insight) {
  return insight.agent_name === "morning_brief" || insight.type === "MORNING_BRIEF";
}

function localBrief(plan: DayPlan | undefined, tradeCount: number) {
  const symbols = (plan?.events ?? []).map((e) => e.title).filter(Boolean);
  const pending = (plan?.items ?? []).filter((i) => !i.done);
  const done = (plan?.items ?? []).filter((i) => i.done);
  const parts = [
    symbols.length
      ? `On the calendar: ${symbols.slice(0, 6).join(", ")}.`
      : "No session events logged yet.",
    tradeCount === 0
      ? "No trades logged for this day yet."
      : `${tradeCount} trade${tradeCount === 1 ? "" : "s"} already on the tape.`,
  ];
  if (done.length) parts.push(`${done.length} game-plan item${done.length === 1 ? "" : "s"} already checked.`);
  if (pending.length) parts.push(`Still open: ${pending.map((i) => i.label).slice(0, 4).join(", ")}.`);
  parts.push("Trade only what is on the plan. If the tape does not match, stand down.");
  return parts.join(" ");
}

export function MarketSentimentCard({
  plan,
  accountId,
  date,
  tradeCount,
  loading,
}: {
  plan?: DayPlan;
  accountId?: string;
  date: string;
  tradeCount: number;
  loading?: boolean;
}) {
  const toast = useToast();
  const { data: insights = [] } = useAgentInsights();
  const runAgent = useRunAgent();
  const saveBrief = useSaveDayBriefing(accountId, date);

  const latest = useMemo(() => insights.find(isMorningBrief) ?? null, [insights]);
  const fallback = useMemo(() => localBrief(plan, tradeCount), [plan, tradeCount]);
  const body = (plan?.briefing || "").trim() || latest?.body?.trim() || fallback;
  const ready = Boolean((plan?.briefing || "").trim() || latest || (plan?.items.length ?? 0) > 0);

  async function generate() {
    if (!plan) return;
    let briefing = fallback;
    try {
      const result = await runAgent.mutateAsync("morning_brief");
      if (result.run.status === "success" && result.insight?.body) {
        briefing = result.insight.body;
      } else if (result.run.message) {
        toast.info(result.run.message);
      }
    } catch (err) {
      toast.info(err instanceof ApiError ? err.message : "Using your game plan for this briefing.");
    }
    try {
      await saveBrief.mutateAsync({ planId: plan.id, briefing });
      toast.success("Briefing saved for this day");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t save briefing");
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
            <h2 className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
              Market Sentiment Briefing
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">This day</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--color-primary-very-light)] px-2 py-0.5 text-[10px] font-medium text-primary">
            {ready ? "Ready" : "Idle"}
          </span>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!plan || runAgent.isPending || saveBrief.isPending}
            className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)] disabled:opacity-60"
          >
            {runAgent.isPending || saveBrief.isPending ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
      ) : (
        <p className="text-[13px] leading-6 text-[var(--color-text-secondary)]">{body}</p>
      )}
    </section>
  );
}
