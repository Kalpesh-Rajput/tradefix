"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useUpsertMoodCheckin } from "@/lib/hooks/useMood";

const EMOTIONS = ["Calm", "Focused", "Anxious", "FOMO", "Confident", "Tired", "Revenge"];

export function MindsetCheckin() {
  const [open, setOpen] = useState(false);
  const [confidence, setConfidence] = useState(7);
  const [stress, setStress] = useState(3);
  const [emotions, setEmotions] = useState<string[]>(["Focused"]);
  const [notes, setNotes] = useState("");
  const upsert = useUpsertMoodCheckin();

  const moodScore = useMemo(() => {
    return Math.min(10, Math.max(1, Math.round((confidence + (10 - stress)) / 2)));
  }, [confidence, stress]);

  function toggleEmotion(e: string) {
    setEmotions((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));
  }

  async function save() {
    const date = new Date().toISOString().slice(0, 10);
    const journal = [emotions.length ? `Emotions: ${emotions.join(", ")}` : "", notes.trim()]
      .filter(Boolean)
      .join("\n");
    await upsert.mutateAsync({ date, mood_score: moodScore, notes: journal || undefined });
    setOpen(false);
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-0 flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/[0.12]"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden>
            🧠
          </span>
          <div>
            <div className="text-xs text-zinc-500">Mindset Check-in</div>
            <div className="text-sm text-zinc-300">Tap to start pre-session</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
              <SliderRow label="Confidence" value={confidence} onChange={setConfidence} />
              <SliderRow label="Stress" value={stress} onChange={setStress} accent="warning" />

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Emotion</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((e) => {
                    const on = emotions.includes(e);
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => toggleEmotion(e)}
                        className={`rounded-lg px-3 py-1.5 text-xs transition ${
                          on
                            ? "border border-primary/30 bg-primary/10 text-primary"
                            : "border border-white/10 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {e}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Journal note</p>
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What's on your mind before the session?"
                  className="border-white/10 bg-zinc-900"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={save} disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving…" : "Save Check-in"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  accent = "primary",
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  accent?: "primary" | "warning";
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
        <span className={accent === "primary" ? "text-primary" : "text-warning"}>{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-primary"
      />
    </div>
  );
}
