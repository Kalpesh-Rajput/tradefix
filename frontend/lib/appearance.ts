export const APPEARANCE_STORAGE_KEY = "tradefix_appearance";

export const THEMES = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];
export type ResolvedTheme = "dark" | "light";

export const ACCENT_COLORS = [
  "teal",
  "blue",
  "purple",
  "orange",
  "red",
  "pink",
  "emerald",
  "periwinkle",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export type AccentDefinition = {
  id: AccentColor;
  label: string;
  hex: string;
  hsl: string;
  foreground: string;
};

/** Matches SuperTrader palette; labels match the Appearance screenshot. */
export const ACCENT_PALETTE: Record<AccentColor, AccentDefinition> = {
  teal: { id: "teal", label: "Teal", hex: "#00C896", hsl: "165 100% 39%", foreground: "0 0% 0%" },
  blue: { id: "blue", label: "Blue", hex: "#3B82F6", hsl: "217 91% 60%", foreground: "0 0% 100%" },
  purple: { id: "purple", label: "Purple", hex: "#8B5CF6", hsl: "258 90% 66%", foreground: "0 0% 100%" },
  orange: { id: "orange", label: "Orange", hex: "#F59E0B", hsl: "38 92% 50%", foreground: "0 0% 0%" },
  red: { id: "red", label: "Red", hex: "#EF4444", hsl: "0 84% 60%", foreground: "0 0% 100%" },
  pink: { id: "pink", label: "Pink", hex: "#EC4899", hsl: "330 81% 60%", foreground: "0 0% 100%" },
  emerald: { id: "emerald", label: "Emerald", hex: "#10B981", hsl: "160 84% 39%", foreground: "0 0% 100%" },
  periwinkle: { id: "periwinkle", label: "Periwinkle", hex: "#6366F1", hsl: "239 84% 67%", foreground: "0 0% 100%" },
};

export type AppearanceState = {
  theme: ThemePreference;
  accent: AccentColor;
};

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: "dark",
  accent: "teal",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && (ACCENT_COLORS as readonly string[]).includes(value);
}

export function resolveTheme(preference: ThemePreference, systemDark = true): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

export function readStoredAppearance(): AppearanceState {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as { theme?: string; accent?: string; accent_color?: string };
    return {
      theme: isThemePreference(parsed.theme) ? parsed.theme : DEFAULT_APPEARANCE.theme,
      accent: isAccentColor(parsed.accent)
        ? parsed.accent
        : isAccentColor(parsed.accent_color)
          ? parsed.accent_color
          : DEFAULT_APPEARANCE.accent,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeStoredAppearance(state: AppearanceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function applyAppearanceToDocument(state: AppearanceState, systemDark?: boolean) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const prefersDark =
    systemDark ??
    (typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : true);
  const resolved = resolveTheme(state.theme, prefersDark);
  const accent = ACCENT_PALETTE[state.accent] ?? ACCENT_PALETTE.teal;

  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
  root.dataset.accent = accent.id;

  root.style.setProperty("--primary", accent.hsl);
  root.style.setProperty("--primary-foreground", accent.foreground);
  root.style.setProperty("--accent", accent.hsl);
  root.style.setProperty("--ring", accent.hsl);
  root.style.setProperty("--accent-hex", accent.hex);

  if (resolved === "light") {
    root.style.setProperty("--background", "0 0% 98%");
    root.style.setProperty("--foreground", "240 6% 10%");
    root.style.setProperty("--surface", "0 0% 100%");
    root.style.setProperty("--surface-2", "240 5% 96%");
    root.style.setProperty("--sidebar", "0 0% 100%");
    root.style.setProperty("--border", "240 6% 10% / 0.1");
    root.style.setProperty("--muted", "240 4% 46%");
    root.style.setProperty("--card", "0 0% 100%");
  } else {
    root.style.setProperty("--background", "0 0% 0%");
    root.style.setProperty("--foreground", "0 0% 98%");
    root.style.setProperty("--surface", "240 6% 4%");
    root.style.setProperty("--surface-2", "240 4% 10%");
    root.style.setProperty("--sidebar", "0 0% 0%");
    root.style.setProperty("--border", "0 0% 100% / 0.06");
    root.style.setProperty("--muted", "240 4% 46%");
    root.style.setProperty("--card", "240 6% 4%");
  }
}

export const NEGATIVE_HEX = "#EF4444";

export function readAccentHex(): string {
  if (typeof document === "undefined") return ACCENT_PALETTE.teal.hex;
  const inline = document.documentElement.style.getPropertyValue("--accent-hex").trim();
  if (inline) return inline;
  try {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent-hex").trim() || ACCENT_PALETTE.teal.hex;
  } catch {
    return ACCENT_PALETTE.teal.hex;
  }
}

/** Inline boot script to avoid flash of wrong theme before React hydrates. */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(APPEARANCE_STORAGE_KEY)};var raw=localStorage.getItem(k);var theme="dark";var accent="teal";if(raw){var p=JSON.parse(raw);if(p&&typeof p.theme==="string")theme=p.theme;if(p&&typeof p.accent==="string")accent=p.accent;else if(p&&typeof p.accent_color==="string")accent=p.accent_color;}var accents={teal:{hsl:"165 100% 39%",fg:"0 0% 0%",hex:"#00C896"},blue:{hsl:"217 91% 60%",fg:"0 0% 100%",hex:"#3B82F6"},purple:{hsl:"258 90% 66%",fg:"0 0% 100%",hex:"#8B5CF6"},orange:{hsl:"38 92% 50%",fg:"0 0% 0%",hex:"#F59E0B"},red:{hsl:"0 84% 60%",fg:"0 0% 100%",hex:"#EF4444"},pink:{hsl:"330 81% 60%",fg:"0 0% 100%",hex:"#EC4899"},emerald:{hsl:"160 84% 39%",fg:"0 0% 100%",hex:"#10B981"},periwinkle:{hsl:"239 84% 67%",fg:"0 0% 100%",hex:"#6366F1"}};var a=accents[accent]||accents.teal;var dark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);r.classList.toggle("light",!dark);r.style.colorScheme=dark?"dark":"light";r.style.setProperty("--primary",a.hsl);r.style.setProperty("--primary-foreground",a.fg);r.style.setProperty("--accent",a.hsl);r.style.setProperty("--ring",a.hsl);r.style.setProperty("--accent-hex",a.hex);if(dark){r.style.setProperty("--background","0 0% 0%");r.style.setProperty("--foreground","0 0% 98%");r.style.setProperty("--surface","240 6% 4%");r.style.setProperty("--surface-2","240 4% 10%");r.style.setProperty("--sidebar","0 0% 0%");r.style.setProperty("--border","0 0% 100% / 0.06");}else{r.style.setProperty("--background","0 0% 98%");r.style.setProperty("--foreground","240 6% 10%");r.style.setProperty("--surface","0 0% 100%");r.style.setProperty("--surface-2","240 5% 96%");r.style.setProperty("--sidebar","0 0% 100%");r.style.setProperty("--border","240 6% 10% / 0.1");}}catch(e){}})();`;
