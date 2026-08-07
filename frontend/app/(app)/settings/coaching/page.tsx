"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsSelect,
  SettingsShell,
  SettingsTextarea,
} from "@/components/settings/SettingsShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useInviteCoach, useMentorCoaches, useMentorStudents } from "@/lib/hooks/useMentor";
import { useMoodCheckins, useUpsertMoodCheckin } from "@/lib/hooks/useMood";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CoachingSettingsPage() {
  const toast = useToast();
  const { data: moodCheckins } = useMoodCheckins();
  const upsertMood = useUpsertMoodCheckin();
  const { data: coaches = [] } = useMentorCoaches();
  const { data: students = [] } = useMentorStudents();
  const invite = useInviteCoach();

  const [moodScore, setMoodScore] = useState("7");
  const [moodNotes, setMoodNotes] = useState("");
  const [coachEmail, setCoachEmail] = useState("");

  function handleMoodSubmit(e: FormEvent) {
    e.preventDefault();
    upsertMood.mutate({ date: todayIso(), mood_score: Number(moodScore), notes: moodNotes || undefined });
    setMoodNotes("");
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    const email = coachEmail.trim().toLowerCase();
    if (!email) return;
    try {
      await invite.mutateAsync(email);
      toast.success("Coach invited", email);
      setCoachEmail("");
    } catch (err) {
      toast.error(
        "Invite failed",
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : undefined
      );
    }
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Coaching"
        subtitle="Mindset check-ins, mentor invites, and coach dashboard."
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

        <SettingsCard
          title="Invite a coach"
          description="Your coach can leave trade comments. They must already have a TradeFix account."
        >
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <SettingsField label="Coach email">
              <SettingsInput
                type="email"
                value={coachEmail}
                onChange={(e) => setCoachEmail(e.target.value)}
                placeholder="coach@example.com"
                className="w-64"
              />
            </SettingsField>
            <Button type="submit" size="sm" disabled={invite.isPending}>
              {invite.isPending ? "Inviting…" : "Invite"}
            </Button>
          </form>

          {coaches.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {coaches.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{c.coach_email}</span>
                  <Badge tone="neutral">{c.status}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
        </SettingsCard>

        {students.length > 0 ? (
          <SettingsCard title="Your students" description="Accounts that invited you as coach.">
            <ul className="space-y-2">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm text-zinc-300">
                  <span>{s.trader_name || s.trader_email}</span>
                  <Link href="/coach" className="text-xs text-primary hover:underline">
                    Open dashboard
                  </Link>
                </li>
              ))}
            </ul>
          </SettingsCard>
        ) : null}
      </div>
    </SettingsShell>
  );
}
