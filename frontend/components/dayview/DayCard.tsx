"use client";

import { useState } from "react";

import { AgentOutput } from "@/components/agents/AgentOutput";
import { DailyStats } from "@/components/dayview/DailyStats";
import { DayCardHeader } from "@/components/dayview/DayCardHeader";
import { DayTradesTable } from "@/components/dayview/DayTradesTable";
import { PnLChart } from "@/components/dayview/PnLChart";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useRunAgent, useUpdateAgent, useUserAgents } from "@/lib/hooks/useAgents";
import type { AgentOutput as AgentOutputData, CalendarDay, Trade } from "@/lib/types";

export type DayViewRow = CalendarDay & {
  id: string;
  title: string;
};

type Props = {
  row: DayViewRow;
  accountId?: string;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  trades: Trade[];
  onAddNote: () => void;
  defaultTradesOpen?: boolean;
};

export function DayCard({ row, accountId, formatMoney, trades, onAddNote, defaultTradesOpen = false }: Props) {
  const { t } = useLocale();
  const toast = useToast();
  const [tradesOpen, setTradesOpen] = useState(defaultTradesOpen);
  const [review, setReview] = useState<AgentOutputData | null>(null);
  const agents = useUserAgents();
  const runAgent = useRunAgent();
  const update = useUpdateAgent();
  const agent = (agents.data ?? []).find((item) => item.template_key === "session_review");
  const pnl = Number(row.pnl);
  const summary = `${row.title} · ${trades.length} trades · ${formatMoney(pnl, { signed: true, digits: 2 })}`;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success(t("dayView.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function reviewDay() {
    if (!agent) {
      window.location.href = "/agents?create=session_review";
      return;
    }
    if (agent.status !== "active") {
      try {
        await update.mutateAsync({
          id: agent.id,
          body: { status: "active", trigger_types: Array.from(new Set([...(agent.trigger_types || []), "day_view", "manual"])) },
        });
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Couldn’t enable Session Review");
        return;
      }
    }
    try {
      const result = await runAgent.mutateAsync({
        id: agent.id,
        trigger: "day_view",
        account_id: accountId,
        date: row.date,
      });
      if (result.status === "failed") {
        toast.error(result.error || "Session review failed");
        return;
      }
      setReview(result.output ?? null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Session review failed");
    }
  }

  return (
    <article
      id={`day-${row.id}`}
      className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
    >
      <DayCardHeader
        title={row.title}
        pnl={pnl}
        open={tradesOpen}
        onToggle={() => setTradesOpen((v) => !v)}
        formatMoney={formatMoney}
        onReview={() => void reviewDay()}
        onAddNote={onAddNote}
        onMore={() => void copySummary()}
      />

      <div className="px-5 pb-5">
        {runAgent.isPending ? (
          <p className="mb-4 text-[13px] text-[var(--color-text-secondary)]">Checking rule adherence…</p>
        ) : null}
        {review ? (
          <div className="mb-4 rounded-lg border border-[var(--color-border)] p-3">
            <AgentOutput output={review} />
          </div>
        ) : null}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <PnLChart values={row.curve ?? [0, pnl]} formatMoney={formatMoney} />
          <DailyStats row={row} formatMoney={formatMoney} />
        </div>
        {tradesOpen ? <DayTradesTable trades={trades} formatMoney={formatMoney} /> : null}
      </div>
    </article>
  );
}
