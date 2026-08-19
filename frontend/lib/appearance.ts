export const APPEARANCE_STORAGE_KEY = "tradefix_appearance";

export const THEMES = ["dark", "light", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];
export type ResolvedTheme = "dark" | "light";

/** No green accents — profit/positive UI always follows brand purple (or selected accent). */
export const ACCENT_COLORS = [
  "purple",
  "blue",
  "orange",
  "red",
  "pink",
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

/** Brand accents; purple is the product default. No teal/emerald/green. */
export const ACCENT_PALETTE: Record<AccentColor, AccentDefinition> = {
  purple: { id: "purple", label: "Purple", hex: "#5B4696", hsl: "255 36% 43%", foreground: "0 0% 100%" },
  blue: { id: "blue", label: "Blue", hex: "#3B82F6", hsl: "217 91% 60%", foreground: "0 0% 100%" },
  orange: { id: "orange", label: "Orange", hex: "#F59E0B", hsl: "38 92% 50%", foreground: "0 0% 0%" },
  red: { id: "red", label: "Red", hex: "#E35D68", hsl: "355 71% 63%", foreground: "0 0% 100%" },
  pink: { id: "pink", label: "Pink", hex: "#EC4899", hsl: "330 81% 60%", foreground: "0 0% 100%" },
  periwinkle: { id: "periwinkle", label: "Periwinkle", hex: "#6366F1", hsl: "239 84% 67%", foreground: "0 0% 100%" },
};

/** @deprecated Alias — positive follows accent; kept for call sites. */
export const POSITIVE_HEX = ACCENT_PALETTE.purple.hex;
export const NEGATIVE_HEX = "#E35D68";
export const NEGATIVE_HSL = "355 71% 63%";
export const CHART_LINE_HEX = "#4B438B";

export type AppearanceState = {
  theme: ThemePreference;
  accent: AccentColor;
};

export const DEFAULT_APPEARANCE: AppearanceState = {
  theme: "light",
  accent: "purple",
};

/** Map removed green accents (and typos) to purple. */
function migrateAccent(value: unknown): AccentColor | null {
  if (typeof value !== "string") return null;
  if (value === "teal" || value === "emerald" || value === "green") return "purple";
  if ((ACCENT_COLORS as readonly string[]).includes(value)) return value as AccentColor;
  return null;
}

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
    const accent =
      migrateAccent(parsed.accent) ??
      migrateAccent(parsed.accent_color) ??
      DEFAULT_APPEARANCE.accent;
    return {
      theme: isThemePreference(parsed.theme) ? parsed.theme : DEFAULT_APPEARANCE.theme,
      accent,
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
  const accent = ACCENT_PALETTE[state.accent] ?? ACCENT_PALETTE.purple;

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
  root.style.setProperty("--color-primary", accent.hex);

  /* Sidebar — dark purple-charcoal in both themes */
  root.style.setProperty("--sidebar", "264 21% 14%");
  root.style.setProperty("--sidebar-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-muted", "255 12% 79%");
  root.style.setProperty("--sidebar-border", "264 14% 24%");
  root.style.setProperty("--color-sidebar", "#231D2C");

  /* Profit/positive follows accent — no green */
  root.style.setProperty("--positive", accent.hsl);
  root.style.setProperty("--color-success", accent.hex);
  root.style.setProperty("--negative", NEGATIVE_HSL);
  root.style.setProperty("--destructive", NEGATIVE_HSL);
  root.style.setProperty("--color-danger", NEGATIVE_HEX);

  const accentSoft = accent.hsl.split(" ").slice(0, 2).join(" ");

  if (resolved === "light") {
    root.style.setProperty("--background", "200 11% 95%");
    root.style.setProperty("--foreground", "240 10% 9%");
    root.style.setProperty("--surface", "0 0% 100%");
    root.style.setProperty("--surface-2", "220 14% 96%");
    root.style.setProperty("--border", "240 8% 92%");
    root.style.setProperty("--muted", "233 5% 36%");
    root.style.setProperty("--card", "0 0% 100%");
    root.style.setProperty("--positive-soft", `${accentSoft} 94%`);
    root.style.setProperty("--negative-soft", "355 67% 97%");
    root.style.setProperty("--color-background", "#F2F4F5");
    root.style.setProperty("--color-surface", "#FFFFFF");
    root.style.setProperty("--color-surface-secondary", "#FEFEFE");
    root.style.setProperty("--color-border", "#E8E8EC");
    root.style.setProperty("--color-border-light", "#EEEEF1");
    root.style.setProperty("--color-border-subtle", "#ECECF0");
    root.style.setProperty("--color-divider", "#ECECF0");
    root.style.setProperty("--color-text-primary", "#14151A");
    root.style.setProperty("--color-text-secondary", "#4A4B52");
    root.style.setProperty("--color-text-tertiary", "#6B6C74");
    root.style.setProperty("--color-text-muted", "#85868E");
    root.style.setProperty("--color-text-kpi", "#111218");
    root.style.setProperty("--color-text-label", "#4F5058");
    root.style.setProperty("--color-primary-light", "#F0ECFA");
    root.style.setProperty("--color-primary-very-light", "#F7F4FC");
    root.style.setProperty("--color-success-bg", "#F0ECFA");
    root.style.setProperty("--color-success-light", "#F7F4FC");
    root.style.setProperty("--color-danger-light", "#F8DDE0");
    root.style.setProperty("--color-danger-bg", "#FDF0F1");
    root.style.setProperty("--color-chart-grid", "#ECEDEF");
    root.style.setProperty("--color-chart-axis", "#85868E");
    root.style.setProperty("--color-gauge-track", "#E7E8EC");
    root.style.setProperty("--shadow-sm", "0 1px 3px rgba(20, 20, 30, 0.04)");
    root.style.setProperty("--shadow-md", "0 2px 8px rgba(20, 20, 30, 0.03)");
    root.style.setProperty("--shadow-dropdown", "0 8px 24px rgba(20, 20, 30, 0.1)");
    root.style.setProperty("--focus-ring", `0 0 0 2px ${accent.hex}26`);
  } else {
    root.style.setProperty("--background", "250 14% 7%");
    root.style.setProperty("--foreground", "0 0% 96%");
    root.style.setProperty("--surface", "250 12% 11%");
    root.style.setProperty("--surface-2", "250 10% 15%");
    root.style.setProperty("--border", "250 8% 20%");
    root.style.setProperty("--muted", "250 6% 62%");
    root.style.setProperty("--card", "250 12% 12%");
    root.style.setProperty("--positive-soft", `${accentSoft} 18%`);
    root.style.setProperty("--negative-soft", "355 35% 16%");
    root.style.setProperty("--color-background", "#121118");
    root.style.setProperty("--color-surface", "#1A1822");
    root.style.setProperty("--color-surface-secondary", "#221F2B");
    root.style.setProperty("--color-border", "#2E2A38");
    root.style.setProperty("--color-border-light", "#353140");
    root.style.setProperty("--color-border-subtle", "#2A2633");
    root.style.setProperty("--color-divider", "#2A2633");
    root.style.setProperty("--color-text-primary", "#F2F2F5");
    root.style.setProperty("--color-text-secondary", "#B4B1BD");
    root.style.setProperty("--color-text-tertiary", "#8E8A99");
    root.style.setProperty("--color-text-muted", "#7A7585");
    root.style.setProperty("--color-text-kpi", "#F7F7FA");
    root.style.setProperty("--color-text-label", "#A8A4B2");
    root.style.setProperty("--color-primary-light", "#2C2540");
    root.style.setProperty("--color-primary-very-light", "#241F33");
    root.style.setProperty("--color-success-bg", "#2C2540");
    root.style.setProperty("--color-success-light", "#241F33");
    root.style.setProperty("--color-danger-light", "#3A2226");
    root.style.setProperty("--color-danger-bg", "#2E1B1E");
    root.style.setProperty("--color-chart-grid", "#2A2633");
    root.style.setProperty("--color-chart-axis", "#7A7585");
    root.style.setProperty("--color-gauge-track", "#2E2A38");
    root.style.setProperty("--color-warning-badge", "#5C4E1A");
    root.style.setProperty("--color-warning-badge-text", "#F5E7A0");
    root.style.setProperty("--shadow-sm", "0 1px 3px rgba(0, 0, 0, 0.35)");
    root.style.setProperty("--shadow-md", "0 2px 8px rgba(0, 0, 0, 0.35)");
    root.style.setProperty("--shadow-dropdown", "0 8px 24px rgba(0, 0, 0, 0.45)");
    root.style.setProperty("--focus-ring", `0 0 0 2px ${accent.hex}40`);
  }
}

export function readAccentHex(): string {
  if (typeof document === "undefined") return ACCENT_PALETTE.purple.hex;
  const inline = document.documentElement.style.getPropertyValue("--accent-hex").trim();
  if (inline) return inline;
  try {
    return getComputedStyle(document.documentElement).getPropertyValue("--accent-hex").trim() || ACCENT_PALETTE.purple.hex;
  } catch {
    return ACCENT_PALETTE.purple.hex;
  }
}

/** Profit color = current accent (never green). */
export function readPositiveHex(): string {
  return readAccentHex();
}

/** Inline boot script to avoid flash of wrong theme before React hydrates. */
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(APPEARANCE_STORAGE_KEY)};var raw=localStorage.getItem(k);var theme="light";var accent="purple";if(raw){var p=JSON.parse(raw);if(p&&typeof p.theme==="string")theme=p.theme;if(p&&typeof p.accent==="string")accent=p.accent;else if(p&&typeof p.accent_color==="string")accent=p.accent_color;}if(accent==="teal"||accent==="emerald"||accent==="green")accent="purple";var accents={purple:{hsl:"255 36% 43%",fg:"0 0% 100%",hex:"#5B4696"},blue:{hsl:"217 91% 60%",fg:"0 0% 100%",hex:"#3B82F6"},orange:{hsl:"38 92% 50%",fg:"0 0% 0%",hex:"#F59E0B"},red:{hsl:"355 71% 63%",fg:"0 0% 100%",hex:"#E35D68"},pink:{hsl:"330 81% 60%",fg:"0 0% 100%",hex:"#EC4899"},periwinkle:{hsl:"239 84% 67%",fg:"0 0% 100%",hex:"#6366F1"}};var a=accents[accent]||accents.purple;var dark=theme==="dark"||(theme==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",dark);r.classList.toggle("light",!dark);r.style.colorScheme=dark?"dark":"light";r.dataset.theme=dark?"dark":"light";r.style.setProperty("--primary",a.hsl);r.style.setProperty("--primary-foreground",a.fg);r.style.setProperty("--accent",a.hsl);r.style.setProperty("--ring",a.hsl);r.style.setProperty("--accent-hex",a.hex);r.style.setProperty("--color-primary",a.hex);r.style.setProperty("--positive",a.hsl);r.style.setProperty("--color-success",a.hex);r.style.setProperty("--negative","355 71% 63%");r.style.setProperty("--destructive","355 71% 63%");r.style.setProperty("--color-danger","#E35D68");r.style.setProperty("--sidebar","264 21% 14%");r.style.setProperty("--sidebar-foreground","0 0% 100%");r.style.setProperty("--sidebar-muted","255 12% 79%");r.style.setProperty("--sidebar-border","264 14% 24%");r.style.setProperty("--color-sidebar","#231D2C");var soft=a.hsl.split(" ").slice(0,2).join(" ");if(dark){r.style.setProperty("--background","250 14% 7%");r.style.setProperty("--foreground","0 0% 96%");r.style.setProperty("--surface","250 12% 11%");r.style.setProperty("--surface-2","250 10% 15%");r.style.setProperty("--border","250 8% 20%");r.style.setProperty("--muted","250 6% 62%");r.style.setProperty("--card","250 12% 12%");r.style.setProperty("--positive-soft",soft+" 18%");r.style.setProperty("--negative-soft","355 35% 16%");r.style.setProperty("--color-background","#121118");r.style.setProperty("--color-surface","#1A1822");r.style.setProperty("--color-surface-secondary","#221F2B");r.style.setProperty("--color-border","#2E2A38");r.style.setProperty("--color-border-light","#353140");r.style.setProperty("--color-border-subtle","#2A2633");r.style.setProperty("--color-divider","#2A2633");r.style.setProperty("--color-text-primary","#F2F2F5");r.style.setProperty("--color-text-secondary","#B4B1BD");r.style.setProperty("--color-text-tertiary","#8E8A99");r.style.setProperty("--color-text-muted","#7A7585");r.style.setProperty("--color-text-kpi","#F7F7FA");r.style.setProperty("--color-text-label","#A8A4B2");r.style.setProperty("--color-primary-light","#2C2540");r.style.setProperty("--color-primary-very-light","#241F33");r.style.setProperty("--color-success-bg","#2C2540");r.style.setProperty("--color-success-light","#241F33");r.style.setProperty("--color-danger-light","#3A2226");r.style.setProperty("--color-danger-bg","#2E1B1E");r.style.setProperty("--color-chart-grid","#2A2633");r.style.setProperty("--color-chart-axis","#7A7585");r.style.setProperty("--color-gauge-track","#2E2A38");r.style.setProperty("--color-warning-badge","#5C4E1A");r.style.setProperty("--color-warning-badge-text","#F5E7A0");}else{r.style.setProperty("--background","200 11% 95%");r.style.setProperty("--foreground","240 10% 9%");r.style.setProperty("--surface","0 0% 100%");r.style.setProperty("--surface-2","220 14% 96%");r.style.setProperty("--border","240 8% 92%");r.style.setProperty("--muted","233 5% 36%");r.style.setProperty("--card","0 0% 100%");r.style.setProperty("--positive-soft",soft+" 94%");r.style.setProperty("--negative-soft","355 67% 97%");r.style.setProperty("--color-background","#F2F4F5");r.style.setProperty("--color-surface","#FFFFFF");r.style.setProperty("--color-surface-secondary","#FEFEFE");r.style.setProperty("--color-border","#E8E8EC");r.style.setProperty("--color-border-light","#EEEEF1");r.style.setProperty("--color-border-subtle","#ECECF0");r.style.setProperty("--color-divider","#ECECF0");r.style.setProperty("--color-text-primary","#14151A");r.style.setProperty("--color-text-secondary","#4A4B52");r.style.setProperty("--color-text-tertiary","#6B6C74");r.style.setProperty("--color-text-muted","#85868E");r.style.setProperty("--color-text-kpi","#111218");r.style.setProperty("--color-text-label","#4F5058");r.style.setProperty("--color-primary-light","#F0ECFA");r.style.setProperty("--color-primary-very-light","#F7F4FC");r.style.setProperty("--color-success-bg","#F0ECFA");r.style.setProperty("--color-success-light","#F7F4FC");r.style.setProperty("--color-danger-light","#F8DDE0");r.style.setProperty("--color-danger-bg","#FDF0F1");r.style.setProperty("--color-chart-grid","#ECEDEF");r.style.setProperty("--color-chart-axis","#85868E");r.style.setProperty("--color-gauge-track","#E7E8EC");}}catch(e){}})();`;

