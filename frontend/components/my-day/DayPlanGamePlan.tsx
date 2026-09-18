"use client";

import clsx from "clsx";
import { Check, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useAddDayPlanItem, useDeleteDayPlanItem, useUpdateDayPlanItem } from "@/lib/hooks/useDayPlan";
import type { DayPlan } from "@/lib/my-day";

export function DayPlanGamePlan({
  plan,
  accountId,
  date,
  loading,
}: {
  plan?: DayPlan;
  accountId?: string;
  date: string;
  loading?: boolean;
}) {
  const toast = useToast();
  const add = useAddDayPlanItem(accountId, date);
  const update = useUpdateDayPlanItem(accountId, date);
  const remove = useDeleteDayPlanItem(accountId, date);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    setDraft("");
    setEditingId(null);
  }, [date]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const label = draft.trim();
    if (!label || !plan) return;
    try {
      await add.mutateAsync({ planId: plan.id, label });
      setDraft("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t add that item");
    }
  }

  async function saveEdit(itemId: string) {
    const label = editLabel.trim();
    setEditingId(null);
    if (!label) return;
    try {
      await update.mutateAsync({ itemId, label });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t update that item");
    }
  }

  const items = plan?.items ?? [];

  return (
    <section className="dash-card flex flex-col p-4">
      <div className="mb-3 flex h-8 shrink-0 items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Today&apos;s Game Plan</h2>
        {items.length ? (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {items.filter((i) => i.done).length}/{items.length}
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-[var(--color-primary-very-light)]" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.length === 0 ? (
            <li className="pb-2 text-[12px] leading-5 text-[var(--color-text-muted)]">
              Write the rules and habits you will actually follow today. Add one below.
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-[var(--color-primary-very-light)]">
                <button
                  type="button"
                  onClick={() => void update.mutateAsync({ itemId: item.id, done: !item.done }).catch((err) => {
                    toast.error(err instanceof ApiError ? err.message : "Couldn’t update that item");
                  })}
                  className={clsx(
                    "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
                    item.done ? "bg-[#2F9E6A] text-white" : "border border-[var(--color-border)] bg-[var(--color-surface)]"
                  )}
                  aria-pressed={item.done}
                  aria-label={item.done ? `Mark ${item.label} incomplete` : `Complete ${item.label}`}
                >
                  {item.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </button>
                {editingId === item.id ? (
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={() => void saveEdit(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void saveEdit(item.id);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={160}
                    className="h-7 min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[13px] outline-none focus:border-primary"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditLabel(item.label);
                    }}
                    className={clsx(
                      "min-w-0 flex-1 truncate text-left text-[13px]",
                      item.done ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
                    )}
                  >
                    {item.label}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-tertiary)] opacity-0 hover:bg-[var(--color-danger-bg)] hover:text-negative group-hover:opacity-100"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => {
                    void remove.mutateAsync(item.id).catch((err) => {
                      toast.error(err instanceof ApiError ? err.message : "Couldn’t remove that item");
                    });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <form onSubmit={(e) => void onAdd(e)} className="mt-3 flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a rule or habit"
          maxLength={160}
          disabled={!plan || add.isPending}
          className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] outline-none focus:border-primary disabled:opacity-60"
          aria-label="New game plan item"
        />
        <button
          type="submit"
          disabled={!plan || add.isPending || !draft.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[12px] font-medium text-on-accent disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add
        </button>
      </form>
    </section>
  );
}
