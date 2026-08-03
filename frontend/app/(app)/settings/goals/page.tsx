"use client";

import { useEffect, useState } from "react";

import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";

const KEY = "tradefix_goals";

type Goals = {
  daily_goal: string;
  weekly_goal: string;
  monthly_goal: string;
  yearly_goal: string;
};

const INITIAL: Goals = {
  daily_goal: "200",
  weekly_goal: "1000",
  monthly_goal: "4300",
  yearly_goal: "51600",
};

export default function GoalsSettingsPage() {
  const [goals, setGoals] = useState<Goals>(INITIAL);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setGoals({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    localStorage.setItem(KEY, JSON.stringify(goals));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <SettingsShell>
      <SettingsPageHeader title="Goals" subtitle="Set daily through yearly P&L targets." />
      <SettingsCard title="Profit Goals">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["daily_goal", "Daily Goal"],
              ["weekly_goal", "Weekly Goal"],
              ["monthly_goal", "Monthly Goal"],
              ["yearly_goal", "Yearly Goal"],
            ] as const
          ).map(([key, label]) => (
            <SettingsField key={key} label={label}>
              <SettingsInput
                type="number"
                value={goals[key]}
                onChange={(e) => setGoals((g) => ({ ...g, [key]: e.target.value }))}
              />
            </SettingsField>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          {saved && <span className="self-center text-xs text-primary">Saved</span>}
          <Button type="button" onClick={save}>
            Save changes
          </Button>
        </div>
      </SettingsCard>
    </SettingsShell>
  );
}
