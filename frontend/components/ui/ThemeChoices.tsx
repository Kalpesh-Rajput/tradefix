"use client";

import clsx from "clsx";
import { Check, Monitor, MoreHorizontal, Palette } from "lucide-react";
import { useRef, useState } from "react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useToast } from "@/components/ui/Toast";
import { downloadThemeFile, type CustomThemeRecord } from "@/lib/custom-theme";
import {
  DEFAULT_THEME_ID,
  PRESET_CSS_VARIABLES,
  THEME_GROUPS,
  THEME_ORDER,
  THEME_PRESETS,
  type ThemePreference,
  type ThemePresetId,
} from "@/lib/theme-registry";

const BUILT_IN: ThemePreference[] = ["system", ...THEME_ORDER];

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
        <span className={gradient ? "h-3 w-8 rounded-sm" : "h-3 w-3 rounded-sm"} style={{ background: gradient ?? tokens.primary }} />
        <span className="h-3 w-2 rounded-sm" style={{ background: tokens.chartProfit }} />
        <span className="h-3 w-2 rounded-sm" style={{ background: tokens.chartLoss }} />
      </span>
    </span>
  );
}

function CustomSwatch({ theme }: { theme: CustomThemeRecord }) {
  const tokens = theme.tokens;
  return (
    <span className="flex h-8 w-full overflow-hidden rounded-md border" style={{ borderColor: tokens.border, background: tokens.background }} aria-hidden>
      <span className="h-full w-2" style={{ background: tokens.sidebar }} />
      <span className="flex flex-1 items-center gap-1 px-1.5">
        <span className="h-3 flex-1 rounded-sm" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }} />
        <span className="h-3 w-3 rounded-sm" style={{ background: tokens.primary }} />
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
  const { theme, resolvedTheme, setTheme, customThemes, openThemeStudio, deleteCustomTheme, duplicateCustomTheme } = useAppearance();
  const toast = useToast();
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const options = [...BUILT_IN, ...customThemes.map((item) => item.id)];

  async function choose(next: string) {
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
  const activePreset = isPreset(resolvedTheme) ? THEME_PRESETS[resolvedTheme] : undefined;

  return (
    <div className={layout === "grid" ? "flex flex-col gap-3" : "flex flex-col gap-1"}>
      <div
        role="radiogroup"
        aria-label="Theme"
        onKeyDown={(event) => {
          const index = Math.max(0, options.indexOf(theme));
          if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
          event.preventDefault();
          const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
          const next = options[(index + delta + options.length) % options.length];
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
            followSelected ? "border-primary bg-primary/5 text-foreground" : "border-border bg-surface text-foreground hover:border-primary/40"
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
              Signature Light in light mode, Signature Dark in dark mode.
              {followSelected && activePreset && <span className="sr-only"> Currently using {activePreset.name}.</span>}
            </span>
          </span>
        </button>

        {THEME_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className={layout === "grid" ? "contents" : "flex flex-col gap-1"}>
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
                    selected ? "border-primary bg-primary/5 text-foreground" : "border-border bg-surface text-foreground hover:border-primary/40"
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

        {customThemes.length > 0 && (
          <div className={layout === "grid" ? "contents" : "flex flex-col gap-1"}>
            <p className={clsx("mt-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted", layout === "grid" && "sm:col-span-2 lg:col-span-3")}>
              My custom themes
            </p>
            {customThemes.map((item) => (
              <CustomThemeCard
                key={item.id}
                theme={item}
                selected={theme === item.id}
                buttonRef={(node) => {
                  optionRefs.current[item.id] = node;
                }}
                onSelect={() => void choose(item.id)}
                onEdit={() => {
                  openThemeStudio({ mode: "edit", id: item.id });
                  onPicked?.();
                }}
                onDuplicate={() => {
                  void duplicateCustomTheme(item.id)
                    .then(() => toast.success("Theme duplicated"))
                    .catch((err: unknown) => toast.error("Could not duplicate theme", err instanceof Error ? err.message : undefined));
                }}
                onDelete={() => {
                  void deleteCustomTheme(item.id)
                    .then(() => toast.success("Theme deleted"))
                    .catch((err: unknown) => toast.error("Could not delete theme", err instanceof Error ? err.message : undefined));
                }}
                onExport={() => downloadThemeFile(item)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          openThemeStudio({ mode: "create" });
          onPicked?.();
        }}
        className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/40 bg-surface px-3 py-3 text-left text-foreground hover:border-primary"
      >
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Palette className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold">Custom Theme Studio</span>
            <span className="mt-0.5 block text-xs text-muted">Create your own theme by customizing every color across TradeFix.</span>
          </span>
        </span>
        <span className="flex h-8 overflow-hidden rounded-md border border-border" aria-hidden>
          {["#5B4696", "#111827", "#40C79A", "#F26969", "#F3C623", "#2563EB"].map((color) => (
            <span key={color} className="h-full flex-1" style={{ background: color }} />
          ))}
        </span>
        <span className="text-[11px] font-medium text-primary">Opens the editor</span>
      </button>
    </div>
  );
}

function isPreset(value: string): value is ThemePresetId {
  return Object.prototype.hasOwnProperty.call(THEME_PRESETS, value);
}

function CustomThemeCard({
  theme,
  selected,
  buttonRef,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
}: {
  theme: CustomThemeRecord;
  selected: boolean;
  buttonRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className={clsx("relative rounded-xl border", selected ? "border-primary bg-primary/5" : "border-border bg-surface")}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        ref={buttonRef}
        onClick={onSelect}
        className="flex w-full flex-col gap-2 px-3 py-3 pr-12 text-left"
      >
        <CustomSwatch theme={theme} />
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold">{theme.name}</span>
          {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
        </span>
        <span className="text-xs text-muted">Based on {THEME_PRESETS[theme.base_theme_id].name}</span>
      </button>
      <button
        type="button"
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2"
        aria-label={`Actions for ${theme.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-2 top-10 z-10 w-40 rounded-lg border border-border bg-surface p-1 shadow-dropdown">
          <MenuItem
            label="Edit"
            onClick={() => {
              setMenuOpen(false);
              onEdit();
            }}
          />
          <MenuItem
            label="Duplicate"
            onClick={() => {
              setMenuOpen(false);
              onDuplicate();
            }}
          />
          <MenuItem
            label="Export"
            onClick={() => {
              setMenuOpen(false);
              onExport();
            }}
          />
          <MenuItem label="Delete" onClick={() => setConfirmDelete(true)} />
        </div>
      )}
      {confirmDelete && (
        <div className="border-t border-border px-3 py-2 text-xs">
          Delete {theme.name}?{" "}
          <button type="button" className="font-semibold text-destructive" onClick={onDelete}>
            Delete
          </button>{" "}
          <button type="button" className="text-muted" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-2" onClick={onClick}>
      {label}
    </button>
  );
}
