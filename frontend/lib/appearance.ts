import {
  cssCacheFor,
  cssForCustom,
  managedCustomVariables,
  modeForColors,
  parseCustomThemesDocument,
  type ColorMap,
  type CustomThemeRecord,
} from "@/lib/custom-theme";
import {
  buildAppearanceBootScript,
  cssVariablesFor,
  isCustomThemeId,
  isThemePreference as isRegistryPreference,
  migrateStoredTheme,
  PRESET_CSS_VARIABLES,
  resolveTheme as resolvePreset,
  THEME_PREFERENCES,
  THEME_PRESETS,
  type ThemePreference,
  type ThemePresetId,
} from "@/lib/theme-registry";

export const APPEARANCE_STORAGE_KEY = "tradefix_appearance";

export const THEMES = THEME_PREFERENCES;
export type { ThemePreference, ThemePresetId };
export type ResolvedTheme = ThemePresetId;

export const ACCENT_COLORS = ["purple", "blue", "orange", "red", "pink", "periwinkle"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export type AccentDefinition = {
  id: AccentColor;
  label: string;
  hex: string;
  hsl: string;
  foreground: string;
};

/** Kept so older profile values still parse. Presets own color; this palette is not applied. */
export const ACCENT_PALETTE: Record<AccentColor, AccentDefinition> = {
  purple: { id: "purple", label: "Purple", hex: "#4F46E5", hsl: "244 76% 58%", foreground: "0 0% 100%" },
  blue: { id: "blue", label: "Blue", hex: "#2563EB", hsl: "221 83% 53%", foreground: "0 0% 100%" },
  orange: { id: "orange", label: "Orange", hex: "#D97706", hsl: "32 95% 44%", foreground: "0 0% 100%" },
  red: { id: "red", label: "Red", hex: "#B91C1C", hsl: "0 72% 42%", foreground: "0 0% 100%" },
  pink: { id: "pink", label: "Pink", hex: "#BE185D", hsl: "336 74% 42%", foreground: "0 0% 100%" },
  periwinkle: { id: "periwinkle", label: "Periwinkle", hex: "#4F46E5", hsl: "244 76% 58%", foreground: "0 0% 100%" },
};

/** Small financial text. Chart fills use the bar tokens. */
export const POSITIVE_HEX = "var(--color-pnl-positive, var(--color-success-text))";
export const NEGATIVE_HEX = "var(--color-pnl-negative, var(--color-negative-hex, var(--color-chart-loss)))";
export const NEGATIVE_HSL = "0 72% 42%";
export const CHART_LINE_HEX = "var(--color-chart-line)";
export const PNL_PROFIT_HEX = "var(--color-pnl-positive, var(--color-success-text))";
export const PNL_LOSS_HEX = "var(--color-pnl-negative, var(--color-danger-text))";
export const BAR_PROFIT_HEX = "var(--color-chart-profit)";
export const BAR_LOSS_HEX = "var(--color-chart-loss)";
export const COUNT_SERIES_HEX = "var(--color-chart-series)";

export const chartTooltipStyle = {
  background: "var(--color-tooltip-bg)",
  border: "1px solid var(--color-tooltip-border)",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "var(--shadow-dropdown)",
  padding: "6px 10px",
  color: "var(--color-tooltip-text)",
};

export type AppearanceState = {
  theme: string;
  accent: AccentColor;
};

export type StoredCustomThemes = {
  themes: CustomThemeRecord[];
  revision: number;
};

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: "tradefix-purple",
  accent: "purple",
};

function migrateAccent(value: unknown): AccentColor | null {
  if (typeof value !== "string") return null;
  if (value === "teal" || value === "emerald" || value === "green") return "purple";
  if ((ACCENT_COLORS as readonly string[]).includes(value)) return value as AccentColor;
  return null;
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return isRegistryPreference(value);
}

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && (ACCENT_COLORS as readonly string[]).includes(value);
}

export function resolveTheme(preference: string, systemDark = false): ThemePresetId {
  return resolvePreset(preference, systemDark);
}

type StoredBundle = AppearanceState & {
  accent_color?: string;
  customThemes?: unknown;
  customRevision?: unknown;
};

function readStoredBundle(): StoredBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredBundle;
  } catch {
    return null;
  }
}

export function readStoredAppearance(): AppearanceState {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const parsed = readStoredBundle();
    if (!parsed) return DEFAULT_APPEARANCE;
    const accent =
      migrateAccent(parsed.accent) ?? migrateAccent(parsed.accent_color) ?? DEFAULT_APPEARANCE.accent;
    const theme = migrateStoredTheme(parsed.theme);
    const next = { theme, accent };
    if (parsed.theme !== theme) writeStoredAppearance(next);
    return next;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function readStoredCustomThemes(): StoredCustomThemes {
  const parsed = readStoredBundle();
  if (!parsed) return { themes: [], revision: 0 };
  const revision = typeof parsed.customRevision === "number" ? parsed.customRevision : 0;
  const document = parseCustomThemesDocument({ revision, themes: parsed.customThemes });
  return { themes: document.themes, revision: document.revision };
}

export function writeStoredAppearance(state: AppearanceState, custom?: StoredCustomThemes) {
  if (typeof window === "undefined") return;
  try {
    const existing = custom ?? readStoredCustomThemes();
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        theme: state.theme,
        accent: state.accent,
        customThemes: existing.themes,
        customRevision: existing.revision,
        customCss: cssCacheFor(existing.themes),
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

const MANAGED_CSS_KEYS = new Set<string>([
  ...Object.values(PRESET_CSS_VARIABLES).flatMap((vars) => Object.keys(vars)),
  ...managedCustomVariables(),
]);

export function applyCssMap(
  vars: Record<string, string>,
  meta: { mode: "light" | "dark"; themeDataset: string; preference: string; custom: boolean }
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", meta.mode === "dark");
  root.classList.toggle("light", meta.mode === "light");
  root.style.colorScheme = meta.mode;
  root.dataset.theme = meta.themeDataset;
  root.dataset.preference = meta.preference;
  if (meta.custom) root.dataset.customTheme = "1";
  else delete root.dataset.customTheme;

  for (const key of MANAGED_CSS_KEYS) {
    if (!(key in vars)) root.style.removeProperty(key);
  }
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
    MANAGED_CSS_KEYS.add(name);
  }
}

export function applyAppearanceToDocument(
  state: AppearanceState,
  systemDark?: boolean,
  customThemes: CustomThemeRecord[] = readStoredCustomThemes().themes
) {
  if (typeof document === "undefined") return;

  const prefersDark =
    systemDark ??
    (typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false);
  const preference = migrateStoredTheme(state.theme);
  if (isCustomThemeId(preference)) {
    const custom = customThemes.find((theme) => theme.id === preference);
    if (custom) {
      applyCssMap(cssForCustom(custom.base_theme_id, custom.tokens), {
        mode: custom.mode,
        themeDataset: custom.base_theme_id,
        preference,
        custom: true,
      });
      return;
    }
  }
  const resolved = resolveTheme(preference, prefersDark);
  const mode = THEME_PRESETS[resolved].mode;
  const vars = PRESET_CSS_VARIABLES[resolved] ?? cssVariablesFor(resolved);
  applyCssMap(vars, { mode, themeDataset: resolved, preference, custom: false });
}

export function applyPreviewCss(baseId: ThemePresetId, colors: ColorMap) {
  applyCssMap(cssForCustom(baseId, colors), {
    mode: modeForColors(baseId, colors),
    themeDataset: baseId,
    preference: "preview",
    custom: true,
  });
}

export function readAccentHex(): string {
  if (typeof document === "undefined") return THEME_PRESETS["tradefix-purple"].tokens.primary;
  const inline = document.documentElement.style.getPropertyValue("--accent-hex").trim();
  if (inline) return inline;
  try {
    return (
      getComputedStyle(document.documentElement).getPropertyValue("--accent-hex").trim() ||
      THEME_PRESETS["tradefix-purple"].tokens.primary
    );
  } catch {
    return THEME_PRESETS["tradefix-purple"].tokens.primary;
  }
}

/** Accessible profit text, not the pale chart fill. */
export function readPositiveHex(): string {
  if (typeof document === "undefined") return THEME_PRESETS["tradefix-purple"].tokens.successText;
  const inline = document.documentElement.style.getPropertyValue("--color-success-text").trim();
  if (inline) return inline;
  return THEME_PRESETS["tradefix-purple"].tokens.successText;
}

export const APPEARANCE_BOOT_SCRIPT = buildAppearanceBootScript(APPEARANCE_STORAGE_KEY);

export { migrateStoredTheme, resolveSaveResult, THEME_PRESETS, THEME_ORDER } from "@/lib/theme-registry";
