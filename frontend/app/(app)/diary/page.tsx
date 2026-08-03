"use client";

import { MindsetCheckin } from "@/components/dashboard/MindsetCheckin";
import { useMoodCheckins } from "@/lib/hooks/useMood";

export default function DiaryPage() {
  const { data: mood = [] } = useMoodCheckins();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-white">Journal</h1>
        <p className="mt-2 text-sm text-zinc-500">Daily notes and session reflections.</p>
      </div>
      <MindsetCheckin />
      <div className="space-y-3">
        {mood.length === 0 ? (
          <p className="text-sm text-zinc-500">No journal entries yet — use the check-in above to start.</p>
        ) : (
          mood.slice(0, 20).map((m) => (
            <div key={m.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                <span>{m.date}</span>
                <span className="font-mono text-primary">Mood {m.mood_score}/10</span>
              </div>
              <p className="text-sm text-zinc-300">{m.notes || "No notes"}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
