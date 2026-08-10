"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useLocale } from "@/components/providers/LocaleProvider";
import { MoodCheckin, Trade } from "@/lib/types";

export function RecentJournal({
  mood,
  trades,
}: {
  mood: MoodCheckin[];
  trades: Trade[];
}) {
  const { dateKey, formatChartDate } = useLocale();
  const cards = mood.slice(0, 3).map((m) => {
    const moodDay = dateKey(m.date);
    const dayTrades = trades.filter((t) => dateKey(t.opened_at) === moodDay);
    const emotion =
      m.mood_score >= 8 ? "Confident" : m.mood_score >= 5 ? "Neutral" : m.mood_score >= 3 ? "Cautious" : "Stressed";
    return {
      id: m.id,
      emotion,
      session: formatChartDate(m.date),
      summary: m.notes || "No written notes for this check-in.",
      tradeCount: dayTrades.length,
      score: m.mood_score,
    };
  });

  return (
    <Card>
      <CardHeader title="Recent Journal" subtitle="Emotion + session snapshots" />
      {cards.length === 0 ? (
        <p className="text-sm text-muted">Complete a mindset check-in to start your journal trail.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              className="rounded-2xl border border-white/[0.06] bg-background/60 p-4 transition hover:border-white/[0.1]"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone="gold">{c.emotion}</Badge>
                <span className="text-[11px] text-muted">{c.session}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-foreground/90">{c.summary}</p>
              <p className="mt-3 text-xs text-muted">
                Mood {c.score}/10 · {c.tradeCount} trade{c.tradeCount === 1 ? "" : "s"}
              </p>
              <Link href="/settings" className="mt-3 inline-block">
                <Button size="sm" variant="ghost" className="!px-0">
                  Read More →
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}
