"use client";

import clsx from "clsx";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import {
  SettingsCard,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { useToast } from "@/components/ui/Toast";
import {
  ACCENT_COLORS,
  ACCENT_PALETTE,
  type AccentColor,
  type ThemePreference,
} from "@/lib/appearance";

const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: typeof Moon;
  preview: string;
}[] = [
  { id: "dark", label: "Dark", icon: Moon, preview: "bg-zinc-800" },
  { id: "light", label: "Light", icon: Sun, preview: "bg-white" },
  { id: "system", label: "System", icon: Monitor, preview: "bg-gradient-to-br from-white to-zinc-700" },
];

export function AppearanceSettingsPage() {
  const { theme, accent, setTheme, setAccent, saving } = useAppearance();
  const toast = useToast();

  async function handleTheme(next: ThemePreference) {
    if (next === theme) return;
    try {
      await setTheme(next);
    } catch (err) {
      toast.error("Could not save theme", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleAccent(next: AccentColor) {
    if (next === accent) return;
    try {
      await setAccent(next);
    } catch (err) {
      toast.error("Could not save accent", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <SettingsShell>
      <SettingsPageHeader title="Appearance" />

      <div className="space-y-5">
        <SettingsCard title="Theme">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map((opt) => {
              const selected = theme === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleTheme(opt.id)}
                  className={clsx(
                    "relative flex flex-col items-center gap-2 rounded-xl border px-4 py-5 transition",
                    selected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-white/[0.08] bg-zinc-950 text-zinc-400 hover:border-white/20 hover:text-foreground"
                  )}
                >
                  <span className={clsx("h-8 w-8 rounded-md border border-white/10", opt.preview)} />
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            System follows your OS preference. Changes apply instantly.
          </p>
        </SettingsCard>

        <SettingsCard title="Accent Colour">
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((id) => {
              const swatch = ACCENT_PALETTE[id];
              const selected = accent === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={saving}
                  title={swatch.label}
                  aria-label={swatch.label}
                  aria-pressed={selected}
                  onClick={() => handleAccent(id)}
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    selected ? "ring-2 ring-white ring-offset-2 ring-offset-background" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {selected && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Accent colour applies to buttons, badges, highlights, and active states. Current:{" "}
            <span className="text-primary">{ACCENT_PALETTE[accent].label.toLowerCase()}</span>
          </p>
        </SettingsCard>
      </div>
    </SettingsShell>
  );
}
