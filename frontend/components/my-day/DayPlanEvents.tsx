"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { parseLocalIso } from "@/lib/dateLocal";
import { useAddDayPlanEvent, useDeleteDayPlanEvent } from "@/lib/hooks/useDayPlan";
import type { DayPlan, DayPlanImpact } from "@/lib/my-day";

const IMPACTS: { id: DayPlanImpact; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

function formatEventDay(iso: string, locale: string) {
  return parseLocalIso(iso.slice(0, 10)).toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DayPlanEvents({
  plan,
  accountId,
  date,
  locale,
  loading,
}: {
  plan?: DayPlan;
  accountId?: string;
  date: string;
  locale: string;
  loading?: boolean;
}) {
  const toast = useToast();
  const add = useAddDayPlanEvent(accountId, date);
  const remove = useDeleteDayPlanEvent(accountId, date);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [occursOn, setOccursOn] = useState(date);
  const [impact, setImpact] = useState<DayPlanImpact>("high");

  useEffect(() => {
    setOccursOn(date);
  }, [date]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (!next || !plan) return;
    try {
      await add.mutateAsync({
        planId: plan.id,
        title: next,
        note: note.trim() || undefined,
        occurs_on: occursOn || date,
        impact,
      });
      setTitle("");
      setNote("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t add that event");
    }
  }

  const events = plan?.events ?? [];

  return (
    <section className="dash-card flex h-full min-h-[160px] flex-col p-4">
      <div className="mb-3 flex h-11 shrink-0 items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Event Calendar</h2>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">This week</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
          <div className="h-8 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {events.length === 0 ? (
            <li className="text-[12px] leading-5 text-[var(--color-text-muted)]">
              Add the prints, speeches, or levels you will respect around this session.
            </li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-2 rounded-md px-1 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
                    {formatEventDay(event.occurs_on, locale)}
                  </p>
                  <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{event.title}</p>
                  {event.note ? (
                    <p className="truncate text-[11px] text-[var(--color-text-muted)]">{event.note}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={
                      event.impact === "high"
                        ? "text-[10px] font-semibold uppercase tracking-wide text-[#D64545]"
                        : "text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
                    }
                  >
                    {event.impact} impact
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger-bg)] hover:text-negative"
                    aria-label={`Remove ${event.title}`}
                    onClick={() => {
                      void remove.mutateAsync(event.id).catch((err) => {
                        toast.error(err instanceof ApiError ? err.message : "Couldn’t remove that event");
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
      <form onSubmit={(e) => void onAdd(e)} className="mt-3 flex shrink-0 flex-col gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="FOMC, CPI, key level…"
          maxLength={160}
          className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px] outline-none focus:border-primary"
          aria-label="Event title"
        />
        <div className="flex gap-1.5">
          <input
            type="date"
            value={occursOn}
            onChange={(e) => setOccursOn(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px] outline-none focus:border-primary"
            aria-label="Event date"
          />
          <select
            value={impact}
            onChange={(e) => setImpact(e.target.value as DayPlanImpact)}
            className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[12px] outline-none"
            aria-label="Impact"
          >
            {IMPACTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={240}
            className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[12px] outline-none focus:border-primary"
            aria-label="Event note"
          />
          <button
            type="submit"
            disabled={!plan || add.isPending || !title.trim()}
            className="h-8 shrink-0 rounded-md bg-primary px-2.5 text-[12px] font-medium text-on-accent disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
