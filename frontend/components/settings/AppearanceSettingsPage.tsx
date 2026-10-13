"use client";

import { SettingsCard, SettingsPageHeader, SettingsShell } from "@/components/settings/SettingsShell";
import { ThemeChoices } from "@/components/ui/ThemeChoices";

export function AppearanceSettingsPage() {
  return (
    <SettingsShell>
      <SettingsPageHeader title="Appearance" />
      <SettingsCard title="Theme">
        <ThemeChoices />
        <p className="mt-4 text-xs text-muted">
          The theme updates immediately and is saved to your account. Follow device switches between TradeFix
          Classic and Midnight Pro when the operating system appearance changes. Custom Theme Studio saves
          palettes on your account, separate from the built-in themes.
        </p>
      </SettingsCard>
    </SettingsShell>
  );
}
