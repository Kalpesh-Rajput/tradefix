"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTrades } from "@/lib/hooks/useTrades";

export default function WikiPage() {
  const { activeAccount, formatMoney, loading: accountsLoading } = useAccountPrefs();
  const accountId = activeAccount?.id;

  const [symbol, setSymbol] = useState("");
  const [setupTag, setSetupTag] = useState("");
  const [emotionTag, setEmotionTag] = useState("");
  const [notesContains, setNotesContains] = useState("");

  const apiFilters = useMemo(
    () => ({
      account_id: accountId,
      symbol: symbol.trim() || undefined,
      setup_tag: setupTag.trim() || undefined,
      emotion_tag: emotionTag.trim() || undefined,
      limit: 500,
    }),
    [accountId, symbol, setupTag, emotionTag]
  );

  const { data: trades = [], isLoading, isError, refetch } = useTrades(apiFilters, {
    enabled: !!accountId,
  });

  const filtered = useMemo(() => {
    const needle = notesContains.trim().toLowerCase();
    if (!needle) return trades;
    return trades.filter((t) => (t.notes || "").toLowerCase().includes(needle));
  }, [trades, notesContains]);

  const loading = accountsLoading || (isLoading && !!accountId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Personal Trading Wiki</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Search your journaled trades by symbol, setup, emotion, and notes.
        </p>
      </div>

      <Card>
        <CardHeader title="Search filters" subtitle="API filters + client-side notes contains" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Symbol</span>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="ES, NQ…"
              className="border-white/10 bg-black"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Setup tag</span>
            <Input
              value={setupTag}
              onChange={(e) => setSetupTag(e.target.value)}
              placeholder="Breakout"
              className="border-white/10 bg-black"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500">Emotion</span>
            <Input
              value={emotionTag}
              onChange={(e) => setEmotionTag(e.target.value)}
              placeholder="FOMO, calm…"
              className="border-white/10 bg-black"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
              Notes contains
            </span>
            <Input
              value={notesContains}
              onChange={(e) => setNotesContains(e.target.value)}
              placeholder="keyword…"
              className="border-white/10 bg-black"
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSymbol("");
              setSetupTag("");
              setEmotionTag("");
              setNotesContains("");
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-zinc-300">
          Couldn’t load trades.{" "}
          <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No trades match these filters.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">{filtered.length} result{filtered.length === 1 ? "" : "s"}</p>
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/trades/${t.id}`}
              className="block rounded-xl border border-white/[0.06] bg-zinc-950/80 px-4 py-3 transition hover:border-primary/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-white">{t.symbol}</span>
                  <span className="text-xs capitalize text-zinc-500">
                    {t.side} · {t.status}
                  </span>
                  {t.setup_tag ? (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {t.setup_tag}
                    </span>
                  ) : null}
                  {(t.emotion_tags || []).slice(0, 2).map((e) => (
                    <span
                      key={e}
                      className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400"
                    >
                      {e}
                    </span>
                  ))}
                </div>
                <span
                  className={`font-mono text-sm ${
                    (t.pnl ?? 0) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {t.pnl != null ? formatMoney(t.pnl) : "—"}
                </span>
              </div>
              {t.notes ? (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">{t.notes}</p>
              ) : (
                <p className="mt-2 text-xs italic text-zinc-600">No notes</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
