"use client";

import { useEffect, useState } from "react";

import {
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsSelect,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";

const KEY = "tradefix_appearance";

export default function AppearanceSettingsPage() {
  const [accent, setAccent] = useState("teal");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { accent?: string };
        if (parsed.accent) setAccent(parsed.accent);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function save() {
    localStorage.setItem(KEY, JSON.stringify({ theme: "dark", accent }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <SettingsShell>
      <SettingsPageHeader title="Appearance" subtitle="Theme and accent preferences." />
      <SettingsCard title="Theme">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField label="Color Mode">
            <SettingsSelect value="dark" disabled>
              <option value="dark">Dark</option>
            </SettingsSelect>
          </SettingsField>
          <SettingsField label="Accent Color">
            <SettingsSelect value={accent} onChange={(e) => setAccent(e.target.value)}>
              <option value="teal">Teal</option>
              <option value="emerald">Emerald</option>
              <option value="blue">Blue</option>
            </SettingsSelect>
          </SettingsField>
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
