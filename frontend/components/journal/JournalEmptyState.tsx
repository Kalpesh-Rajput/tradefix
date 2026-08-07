"use client";

import { BookOpen, Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function JournalEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300">
        <BookOpen className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-white">
        Start your journal
      </h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        Log a daily recap to track your mindset, decisions, and lessons learned.
      </p>
      <Button className="mt-6" size="lg" onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Add today&apos;s recap
      </Button>
    </div>
  );
}
