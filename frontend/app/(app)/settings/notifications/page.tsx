"use client";

import { useEffect, useState } from "react";

import {
  SettingsCard,
  SettingsPageHeader,
  SettingsShell,
  SettingsToggle,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";

const KEY = "tradefix_notifications";

type Notifs = {
  notify_daily_pnl: boolean;
  notify_trade_alerts: boolean;
  notify_mental_reminders: boolean;
  notify_learning_progress: boolean;
  notify_streak_alerts: boolean;
};

const INITIAL: Notifs = {
  notify_daily_pnl: true,
  notify_trade_alerts: true,
  notify_mental_reminders: true,
  notify_learning_progress: true,
  notify_streak_alerts: true,
};

export default function NotificationsSettingsPage() {
  const [values, setValues] = useState<Notifs>(INITIAL);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setValues({ ...INITIAL, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    localStorage.setItem(KEY, JSON.stringify(values));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  const rows: { key: keyof Notifs; label: string; description: string }[] = [
    { key: "notify_daily_pnl", label: "Daily P&L summary", description: "End-of-day performance digest" },
    { key: "notify_trade_alerts", label: "Trade alerts", description: "Confirmations when trades are logged" },
    { key: "notify_mental_reminders", label: "Mindset reminders", description: "Prompt for pre-session check-ins" },
    { key: "notify_learning_progress", label: "Learning progress", description: "Agent insight highlights" },
    { key: "notify_streak_alerts", label: "Streak alerts", description: "Win / journal streak milestones" },
  ];

  return (
    <SettingsShell>
      <SettingsPageHeader title="Notifications" subtitle="Choose what TradeFix reminds you about." />
      <SettingsCard title="Preferences">
        <div className="divide-y divide-white/[0.04]">
          {rows.map((row) => (
            <div key={row.key} className="py-3 first:pt-0 last:pb-0">
              <SettingsToggle
                checked={values[row.key]}
                onChange={(v) => setValues((s) => ({ ...s, [row.key]: v }))}
                label={row.label}
                description={row.description}
              />
            </div>
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
