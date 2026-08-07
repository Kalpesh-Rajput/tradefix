"use client";

import { MindsetCheckin } from "@/components/dashboard/MindsetCheckin";
import { FeaturePage } from "@/components/ui/FeaturePage";
import { useMoodCheckins } from "@/lib/hooks/useMood";

export default function MindsetPage() {
  const { data: mood = [] } = useMoodCheckins();
  const avg =
    mood.length === 0 ? null : mood.reduce((s, m) => s + m.mood_score, 0) / mood.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Mindset</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Pre-session check-ins{avg != null ? ` · avg mood ${avg.toFixed(1)}/10` : ""}.
        </p>
      </div>
      <MindsetCheckin />
      <FeaturePage title="History" subtitle="Recent mindset scores.">
        {mood.length === 0 ? (
          <p>No check-ins yet.</p>
        ) : (
          <ul className="space-y-2">
            {mood.slice(0, 14).map((m) => (
              <li key={m.id} className="flex justify-between text-sm">
                <span>{m.date}</span>
                <span className="font-mono text-primary">{m.mood_score}/10</span>
              </li>
            ))}
          </ul>
        )}
      </FeaturePage>
    </div>
  );
}
