"use client";

import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useCoachAsk, useCoachStatus, useCoachWeekly } from "@/lib/hooks/useCoach";

type ThreadMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  actions?: string[];
  locked?: boolean;
};

export default function CoachPage() {
  const { activeAccount } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const toast = useToast();

  const { data: status, isLoading: statusLoading } = useCoachStatus(accountId);
  const { data: weekly, isLoading: weeklyLoading } = useCoachWeekly(accountId);
  const ask = useCoachAsk();

  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<ThreadMessage[]>([]);

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    const userMsg: ThreadMessage = { id: `u-${Date.now()}`, role: "user", text: q };
    setThread((t) => [...t, userMsg]);
    setQuestion("");

    try {
      const res = await ask.mutateAsync({ question: q, account_id: accountId });
      setThread((t) => [
        ...t,
        {
          id: `c-${Date.now()}`,
          role: "coach",
          text: res.answer,
          actions: res.actions,
          locked: res.locked,
        },
      ]);
      if (res.locked) {
        toast.info(
          "Need more trades",
          `Coach works best after ${res.required} logged trades (${res.progress} so far).`
        );
      }
    } catch (err) {
      toast.error("Coach unavailable", err instanceof Error ? err.message : undefined);
      setThread((t) => [
        ...t,
        {
          id: `c-${Date.now()}`,
          role: "coach",
          text: "Sorry — coach is temporarily unavailable. Try again shortly.",
        },
      ]);
    }
  }

  const locked = status && !status.eligible;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Coach</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Edge Finder–grounded coaching for {activeAccount?.name ?? "your account"}.
        </p>
      </div>

      {statusLoading ? (
        <Skeleton className="h-24" />
      ) : locked ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Log {status?.required ?? 50} trades to unlock Coach
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Progress: {status?.trades ?? 0} / {status?.required ?? 50} trades
                </p>
                <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(
                        100,
                        ((status?.trades ?? 0) / (status?.required || 50)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <Link href="/trades/new">
              <Button size="sm" variant="secondary">
                Log trades
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex items-center gap-2 text-xs text-positive">
          <Sparkles className="h-3.5 w-3.5" />
          Coach unlocked — grounded in your Edge Finder stats.
        </div>
      )}

      <Card>
        <CardHeader title="Weekly insight" subtitle="Auto-generated from your recent edge" />
        {weeklyLoading ? (
          <Skeleton className="h-16" />
        ) : (
          <p className="text-sm leading-relaxed text-zinc-300">
            {weekly?.insight || "Log more tagged trades to unlock a sharper weekly coach note."}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Conversation" subtitle="Ask about sessions, setups, or risk" />
        <div className="mb-4 max-h-[360px] space-y-3 overflow-y-auto">
          {thread.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Try: “When should I avoid trading?” or “Which setup deserves more size?”
            </p>
          ) : (
            thread.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                    : "mr-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-zinc-200"
                }
              >
                <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  {m.role === "user" ? "You" : "Coach"}
                </p>
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.actions && m.actions.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">
                    {m.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form onSubmit={onAsk} className="space-y-3">
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask your coach…"
            className="border-white/10 bg-zinc-900"
            disabled={ask.isPending}
          />
          <Button type="submit" disabled={ask.isPending || !question.trim()}>
            {ask.isPending ? "Thinking…" : "Ask coach"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
