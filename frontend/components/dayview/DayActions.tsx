"use client";

import { MoreHorizontal, Plus, Sparkles } from "lucide-react";

import { useLocale } from "@/components/providers/LocaleProvider";

const actionClass =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-very-light)]";

export function DayActions({
  onReview,
  onAddNote,
  onMore,
}: {
  onReview: () => void;
  onAddNote: () => void;
  onMore: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button type="button" onClick={onReview} className={actionClass}>
        <Sparkles className="h-3 w-3 text-primary" strokeWidth={1.75} />
        {t("dayView.reviewCoach")}
      </button>
      <button type="button" onClick={onAddNote} className={actionClass}>
        <Plus className="h-3 w-3 text-[var(--color-text-secondary)]" strokeWidth={2} />
        {t("dayView.addNote")}
      </button>
      <button
        type="button"
        onClick={onMore}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)]"
        title={t("dayView.share")}
        aria-label={t("dayView.share")}
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
