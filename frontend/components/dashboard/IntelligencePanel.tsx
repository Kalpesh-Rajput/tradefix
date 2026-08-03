"use client";

import {
  Bot,
  Brain,
  CircleAlert,
  MessageSquare,
  Newspaper,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useGenerateInsights, useInsights } from "@/lib/hooks/useInsights";
import { OverviewStats } from "@/lib/types";

export function IntelligencePanel({
  overview,
}: {
  overview?: OverviewStats;
  todaysPnl?: number;
}) {
  const { data: insights } = useInsights();
  const generate = useGenerateInsights();

  const performance = insights?.find((i) => i.severity === "info" || i.severity === "positive");
  const setup = insights?.find((i) => i.title?.toLowerCase().includes("setup"));
  const risk = insights?.find((i) => i.severity === "warning" || i.severity === "critical");

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
            <Section icon={<Newspaper className="h-3 w-3" />} title="Market Brief">
              <p className="mb-1 text-xs font-medium text-white">
                Broad market advance — all major indices in the green.
              </p>
              <div className="mb-2 flex items-center gap-3">
                {[
                  { s: "SPY", c: "+0.54%" },
                  { s: "QQQ", c: "+0.67%" },
                  { s: "DJI", c: "+0.61%" },
                ].map((t) => (
                  <div key={t.s} className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-zinc-500">{t.s}</span>
                    <span className="font-mono text-[10px] font-medium text-emerald-400">{t.c}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">VIX snapshot — indicative only</p>
              <p className="mt-1.5 text-[10px] text-zinc-600">as of {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ET</p>
            </Section>

            <Section icon={<Brain className="h-3 w-3" />} title="Your Performance">
              {performance ? (
                <>
                  <p className="mb-1 text-xs font-medium text-white">{performance.title}</p>
                  <p className="text-xs leading-relaxed text-zinc-400">{performance.body}</p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-xs font-medium text-white">Keep logging trades to see strategy breakdown</p>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {(overview?.total_trades ?? 0) === 0
                      ? "No trades logged yet — start journaling to see strategy insights."
                      : "Generate insights from the AI Coach to populate this panel."}
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
                {setup?.body || "No setups matching your history today — check back tomorrow."}
              </p>
            </Section>

            <Section icon={<CircleAlert className="h-3 w-3" />} title="Risk Alert">
              <p className="text-xs text-zinc-500">
                {risk?.body || "No concentration alerts — all exposure dimensions within threshold."}
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
