"use client";

import { Check } from "lucide-react";

import type { ProgressSettings } from "@/lib/progress-tracker/types";

export function ProgressSetup({
  settings,
  saving,
  onUseRecommended,
  onChoose,
}: {
  settings: ProgressSettings;
  saving?: boolean;
  onUseRecommended: () => void;
  onChoose: () => void;
}) {
  const hours = `${settings.trading_start_time || "09:30"}–${settings.trading_end_time || "16:00"}`;
  const startBy = settings.start_day_time || "09:00";
  const items = [
    `Trade inside ${hours}`,
    `Start the day by ${startBy}`,
    "Link every trade to a playbook",
    "Require a stop on every trade",
    "Review the plan before the open",
    "Journal the session",
  ];

  return (
    <section className="dash-card p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Set the rules you want to follow</h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--color-text-secondary)]">
        Progress Tracker scores your process. Turn on at least one rule and the streak, heatmap, and follow rate start filling in.
        Recommended rules use your saved session window and add two habits when your list is empty.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-[13px] text-[var(--color-text-primary)]">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-primary">
              <Check className="h-3 w-3" strokeWidth={2.5} />
            </span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="dash-btn-primary" disabled={saving} onClick={onUseRecommended}>
          {saving ? "Saving…" : "Use recommended rules"}
        </button>
        <button type="button" className="dash-btn-secondary" onClick={onChoose}>
          Choose rules
        </button>
      </div>
    </section>
  );
}
