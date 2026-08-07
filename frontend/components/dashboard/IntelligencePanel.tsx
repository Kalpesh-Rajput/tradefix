"use client";

import {
  Bot,
  Brain,
  CircleAlert,
  MessageSquare,
  Activity,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useGenerateInsights, useInsights } from "@/lib/hooks/useInsights";
import { OverviewStats } from "@/lib/types";

export function IntelligencePanel({
  overview,
  todaysPnl,
  todaysTradeCount = 0,
  openCount = 0,
  todaysWinRate,
}: {
  overview?: OverviewStats;
  todaysPnl?: number;
  todaysTradeCount?: number;
  openCount?: number;
  todaysWinRate?: number | null;
}) {
  const { formatMoney } = useAccountPrefs();
  const { data: insights } = useInsights();
  const generate = useGenerateInsights();

  const performance = insights?.find((i) => i.severity === "info" || i.severity === "positive");
  const setup = insights?.find((i) => i.title?.toLowerCase().includes("setup"));
  const risk = insights?.find((i) => i.severity === "warning" || i.severity === "critical");

  const streakLabel =
    overview && overview.current_streak > 0 && overview.current_streak_type !== "none"
      ? `${overview.current_streak} ${overview.current_streak_type}${overview.current_streak === 1 ? "" : "s"}`
      : "No streak";

  return (
    <>
      <aside className="hidden h-full w-[300px] shrink-0 overflow-hidden bg-black/50 xl:block">
        <div className="flex h-full w-[300px] flex-col border-l border-white/[0.06] bg-black">
          <div className="shrink-0 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <Bot className="h-3 w-3 text-primary" />
              </div>
              <span className="text-xs font-medium text-zinc-400">Daily Intelligence</span>
            </div>
          </div>

          <div className="flex-1 divide-y divide-white/[0.04] overflow-y-auto">
            <Section icon={<Activity className="h-3 w-3" />} title="Session Snapshot">
              <p className="mb-2 text-xs font-medium text-white">
                {(todaysTradeCount ?? 0) === 0
                  ? "No trades logged today yet"
                  : `${todaysTradeCount} trade${todaysTradeCount === 1 ? "" : "s"} today`}
              </p>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <StatChip
                  label="Today P&L"
                  value={formatMoney(todaysPnl ?? 0)}
                  tone={(todaysPnl ?? 0) >= 0 ? "pos" : "neg"}
                />
                <StatChip
                  label="Today WR"
                  value={todaysWinRate != null ? `${todaysWinRate.toFixed(0)}%` : "—"}
                />
                <StatChip label="Open" value={String(openCount)} />
                <StatChip label="Streak" value={streakLabel} />
              </div>
              {(overview?.total_trades ?? 0) > 0 && (
                <p className="text-[10px] leading-relaxed text-zinc-500">
                  Best day {formatMoney(overview!.best_day_pnl)} · Worst{" "}
                  {formatMoney(overview!.worst_day_pnl)}
                </p>
              )}
            </Section>

            <Section icon={<Brain className="h-3 w-3" />} title="Your Performance">
              {performance ? (
                <>
                  <p className="mb-1 text-xs font-medium text-white">{performance.title}</p>
                  <p className="text-xs leading-relaxed text-zinc-400">{performance.body}</p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-xs font-medium text-white">
                    {(overview?.total_trades ?? 0) === 0
                      ? "Start journaling to unlock insights"
                      : "Generate insights from your trade history"}
                  </p>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {(overview?.total_trades ?? 0) === 0
                      ? "No trades logged yet — add trades to see strategy insights."
                      : `${overview!.total_trades} closed trades · ${overview!.win_rate}% win rate · ${formatMoney(overview!.total_pnl)} net`}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => generate.mutate()}
                className="mt-2 text-[10px] text-primary hover:underline"
              >
                {generate.isPending ? "Refreshing…" : "Refresh insights"}
              </button>
            </Section>

            <Section icon={<Zap className="h-3 w-3" />} title="Setup Alert">
              <p className="text-xs text-zinc-500">
                {setup?.body || "No setup alerts yet — tag trades with strategies to surface patterns."}
              </p>
            </Section>

            <Section icon={<CircleAlert className="h-3 w-3" />} title="Risk Alert">
              <p className="text-xs text-zinc-500">
                {risk?.body ||
                  (openCount > 0
                    ? `${openCount} open position${openCount === 1 ? "" : "s"} on this account.`
                    : "No open positions and no risk alerts.")}
              </p>
            </Section>

            <Section icon={<Bot className="h-3 w-3" />} title="New from Agents">
              <div className="text-xs leading-relaxed text-zinc-500">
                Activate agents to receive daily trading insights.{" "}
                <Link href="/agents" className="text-primary hover:underline">
                  Browse agents
                </Link>
              </div>
            </Section>
          </div>
        </div>
      </aside>

      <Link
        href="/agents"
        className="fixed bottom-5 right-5 z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-black shadow-lg shadow-primary/30 transition hover:opacity-90"
        title="AI Coach"
      >
        <MessageSquare className="h-5 w-5" />
      </Link>
    </>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div
        className={`mt-0.5 font-mono text-[11px] font-medium ${
          tone === "pos" ? "text-primary" : tone === "neg" ? "text-destructive" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="p-5">
      <div className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        <span className="text-zinc-600">{icon}</span>
        {title}
      </div>
      <div className="text-sm leading-relaxed text-zinc-300">{children}</div>
    </div>
  );
}
