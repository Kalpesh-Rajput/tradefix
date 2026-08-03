"use client";

import { FormEvent, useState } from "react";

import {
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsSelect,
  SettingsShell,
  SettingsTextarea,
} from "@/components/settings/SettingsShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useMoodCheckins, useUpsertMoodCheckin } from "@/lib/hooks/useMood";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CoachingSettingsPage() {
  const { data: moodCheckins } = useMoodCheckins();
  const upsertMood = useUpsertMoodCheckin();
  const [moodScore, setMoodScore] = useState("7");
  const [moodNotes, setMoodNotes] = useState("");

  function handleMoodSubmit(e: FormEvent) {
    e.preventDefault();
    upsertMood.mutate({ date: todayIso(), mood_score: Number(moodScore), notes: moodNotes || undefined });
    setMoodNotes("");
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Coaching"
        subtitle="Mindset check-ins and AI coaching preferences."
      />
      <div className="space-y-5">
        <SettingsCard title="Today's mood check-in" description="Powers Journal Pulse and Daily Intelligence.">
          <form onSubmit={handleMoodSubmit} className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <SettingsField label="Mood score">
                <SettingsSelect value={moodScore} onChange={(e) => setMoodScore(e.target.value)} className="w-44">
                  <option value="1">1 — Rough</option>
                  <option value="3">3 — Off</option>
                  <option value="5">5 — Neutral</option>
                  <option value="7">7 — Good</option>
                  <option value="10">10 — Locked in</option>
                </SettingsSelect>
              </SettingsField>
              <Button type="submit" size="sm" disabled={upsertMood.isPending}>
                Save check-in
              </Button>
            </div>
            <SettingsField label="Notes">
              <SettingsTextarea
                rows={3}
                value={moodNotes}
                onChange={(e) => setMoodNotes(e.target.value)}
                placeholder="Anything affecting your headspace today?"
              />
            </SettingsField>
          </form>

          <div className="mt-4 space-y-1">
            {(moodCheckins ?? []).slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs text-zinc-500">
                <span>{c.date}</span>
                <Badge tone="neutral">Mood {c.mood_score}</Badge>
              </div>
            ))}
          </div>
        </SettingsCard>
      </div>
    </SettingsShell>
  );
}
