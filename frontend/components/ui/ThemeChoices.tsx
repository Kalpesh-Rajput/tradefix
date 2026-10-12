"use client";

import clsx from "clsx";
import { Check, Monitor } from "lucide-react";
import { useRef } from "react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useToast } from "@/components/ui/Toast";
import {
  DEFAULT_THEME_ID,
  PRESET_CSS_VARIABLES,
  THEME_GROUPS,
  THEME_ORDER,
  THEME_PRESETS,
  type ThemePreference,
  type ThemePresetId,
} from "@/lib/theme-registry";

const OPTIONS: ThemePreference[] = ["system", ...THEME_ORDER];

function Swatch({ id }: { id: ThemePresetId }) {
  const tokens = THEME_PRESETS[id].tokens;
  const gradient = PRESET_CSS_VARIABLES[id]["--spectrum-gradient"];
  return (
    <span
      className="flex h-8 w-full overflow-hidden rounded-md border"
      style={{ borderColor: tokens.border, background: tokens.background }}
      aria-hidden
    >
      <span className="h-full w-2" style={{ background: tokens.sidebar }} />
      <span className="flex flex-1 items-center gap-1 px-1.5">
        <span className="h-3 flex-1 rounded-sm" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }} />
        <span
          className={gradient ? "h-3 w-8 rounded-sm" : "h-3 w-3 rounded-sm"}
          style={{ background: gradient ?? tokens.primary }}
        />
        <span className="h-3 w-2 rounded-sm" style={{ background: tokens.chartProfit }} />
        <span className="h-3 w-2 rounded-sm" style={{ background: tokens.chartLoss }} />
      </span>
    </span>
  );
}

export function ThemeChoices({
  layout = "grid",
  onPicked,
}: {
  layout?: "grid" | "menu";
  onPicked?: () => void;
}) {
  const { theme, resolvedTheme, setTheme } = useAppearance();
  const toast = useToast();
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  async function choose(next: ThemePreference) {
    if (next === theme) {
      onPicked?.();
      return;
    }
    try {
      await setTheme(next);
      onPicked?.();
    } catch (err) {
      toast.error("Could not save theme", err instanceof Error ? err.message : undefined);
    }
  }

  const followSelected = theme === "system";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={(event) => {
        const index = Math.max(0, OPTIONS.indexOf(theme));
        if (event.key !== "ArrowDown" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const next = OPTIONS[(index + delta + OPTIONS.length) % OPTIONS.length];
        optionRefs.current[next]?.focus();
        void choose(next);
      }}
      className={layout === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-1"}
    >
      <button
        type="button"
        role="radio"
        aria-checked={followSelected}
        tabIndex={followSelected ? 0 : -1}
        ref={(node) => {
          optionRefs.current.system = node;
        }}
        onClick={() => void choose("system")}
        className={clsx(
          "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors motion-reduce:transition-none",
          layout === "grid" && "sm:col-span-2 lg:col-span-3",
          followSelected
            ? "border-primary bg-primary/5 text-foreground"
            : "border-border bg-surface text-foreground hover:border-primary/40"
        )}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
          <Monitor className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">
            Follow device
            {followSelected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            TradeFix Classic in light mode, Midnight Pro in dark mode.
            {followSelected && (
              <span className="sr-only">
                {" "}
                Currently using {THEME_PRESETS[resolvedTheme].name}.
              </span>
            )}
          </span>
        </span>
      </button>

      {THEME_GROUPS.map((group, groupIndex) => (
        <div
          key={group.label}
          className={layout === "grid" ? "contents" : "flex flex-col gap-1"}
        >
          <p
            className={clsx(
              "px-1 text-[11px] font-semibold uppercase tracking-wider text-muted",
              layout === "grid" && "sm:col-span-2 lg:col-span-3",
              groupIndex > 0 && "mt-2"
            )}
          >
            {group.label}
          </p>
          {group.ids.map((id) => {
            const preset = THEME_PRESETS[id];
            const selected = theme === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  optionRefs.current[id] = node;
                }}
                onClick={() => void choose(id)}
                className={clsx(
                  "flex flex-col gap-2 rounded-xl border px-3 py-3 text-left transition-colors motion-reduce:transition-none",
                  selected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-surface text-foreground hover:border-primary/40"
                )}
              >
                <Swatch id={id} />
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold">{preset.name}</span>
                    {id === DEFAULT_THEME_ID && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Default
                      </span>
                    )}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                </span>
                <span className="text-xs leading-snug text-muted">{preset.description}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
