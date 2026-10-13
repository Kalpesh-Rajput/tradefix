/** Canonical theme presets. Hex is the source of truth; HSL channels are derived. */

export const THEME_PRESET_IDS = [
  "tradefix-purple",
  "classic",
  "midnight-pro",
  "ocean-blue",
  "forest-green",
  "amethyst",
  "warm-sand",
  "obsidian-gold",
  "emerald-luxe",
  "burgundy-champagne",
  "violet-aurora",
  "electric-spectrum",
] as const;

export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

/** Product default when nothing valid is saved. Follow device does not use this. */
export const DEFAULT_THEME_ID: ThemePresetId = "tradefix-purple";

export const THEME_PREFERENCES = [...THEME_PRESET_IDS, "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type ThemeMode = "light" | "dark";

/** Every color role. Values are #RRGGBB. Shadows and the overlay are separate. */
export type ThemeTokens = {
  background: string;
  backgroundSubtle: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceSelected: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textDisabled: string;
  border: string;
  borderStrong: string;
  borderSubtle: string;
  divider: string;
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryForeground: string;
  primarySubtle: string;
  success: string;
  successText: string;
  successSubtle: string;
  danger: string;
  dangerText: string;
  dangerSubtle: string;
  warning: string;
  warningText: string;
  warningSubtle: string;
  info: string;
  infoText: string;
  infoSubtle: string;
  inputBg: string;
  inputBorder: string;
  placeholder: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarMuted: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarBorder: string;
  header: string;
  tableHeader: string;
  tableHover: string;
  tableSelected: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
  chartGrid: string;
  chartAxis: string;
  chartProfit: string;
  chartProfitSoft: string;
  chartLoss: string;
  chartLossSoft: string;
  chartLine: string;
  chartSeries: string;
  chartDrawdown: string;
  skeleton: string;
  scrollbar: string;
};

export type ThemeChrome = {
  overlay: string;
  focusRing: string;
  shadowSm: string;
  shadowMd: string;
  shadowDropdown: string;
};

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  description: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
  chrome: ThemeChrome;
};

export const REQUIRED_TOKEN_KEYS = [
  "background",
  "backgroundSubtle",
  "surface",
  "surfaceElevated",
  "surfaceMuted",
  "surfaceSelected",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "textInverse",
  "textDisabled",
  "border",
  "borderStrong",
  "borderSubtle",
  "divider",
  "primary",
  "primaryHover",
  "primaryActive",
  "primaryForeground",
  "primarySubtle",
  "success",
  "successText",
  "successSubtle",
  "danger",
  "dangerText",
  "dangerSubtle",
  "warning",
  "warningText",
  "warningSubtle",
  "info",
  "infoText",
  "infoSubtle",
  "inputBg",
  "inputBorder",
  "placeholder",
  "sidebar",
  "sidebarForeground",
  "sidebarMuted",
  "sidebarHover",
  "sidebarActive",
  "sidebarBorder",
  "header",
  "tableHeader",
  "tableHover",
  "tableSelected",
  "tooltipBg",
  "tooltipText",
  "tooltipBorder",
  "chartGrid",
  "chartAxis",
  "chartProfit",
  "chartProfitSoft",
  "chartLoss",
  "chartLossSoft",
  "chartLine",
  "chartSeries",
  "chartDrawdown",
  "skeleton",
  "scrollbar",
] as const satisfies readonly (keyof ThemeTokens)[];

const LIGHT_SHADOW: ThemeChrome = {
  overlay: "rgba(17, 24, 39, 0.45)",
  focusRing: "0 0 0 2px var(--color-primary)",
  shadowSm: "0 1px 3px rgba(20, 20, 30, 0.05)",
  shadowMd: "0 2px 8px rgba(20, 20, 30, 0.06)",
  shadowDropdown: "0 8px 24px rgba(20, 20, 30, 0.12)",
};

const DARK_SHADOW: ThemeChrome = {
  overlay: "rgba(2, 6, 23, 0.72)",
  focusRing: "0 0 0 2px var(--color-primary)",
  shadowSm: "0 1px 3px rgba(0, 0, 0, 0.35)",
  shadowMd: "0 2px 8px rgba(0, 0, 0, 0.4)",
  shadowDropdown: "0 8px 24px rgba(0, 0, 0, 0.5)",
};

function preset(
  id: ThemePresetId,
  name: string,
  description: string,
  mode: ThemeMode,
  tokens: ThemeTokens,
  chrome?: Partial<ThemeChrome>
): ThemePreset {
  const base = mode === "dark" ? DARK_SHADOW : LIGHT_SHADOW;
  return {
    id,
    name,
    description,
    mode,
    tokens,
    chrome: chrome ? { ...base, ...chrome } : base,
  };
}

/**
 * Light theme shipped before presets. Values are the committed :root
 * and light-mode appearance application, not a later reinterpretation.
 */
function originalDefaultPreset(): ThemePreset {
  const theme = preset(
    "tradefix-purple",
    "Original TradeFix Purple",
    "The original purple brand, navy sidebar, and light workspace.",
    "light",
    {
      background: "#F2F4F5",
      backgroundSubtle: "#FEFEFE",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#F3F4F6",
      surfaceSelected: "#F0ECFA",
      textPrimary: "#14151A",
      textSecondary: "#4A4B52",
      textMuted: "#85868E",
      textInverse: "#FFFFFF",
      textDisabled: "#6B6C74",
      border: "#E8E8EC",
      borderStrong: "#C8C8CE",
      borderSubtle: "#ECECF0",
      divider: "#ECECF0",
      primary: "#5B4696",
      primaryHover: "#4F3C87",
      primaryActive: "#49377D",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#F0ECFA",
      success: "#5B4696",
      successText: "#2F9E6A",
      successSubtle: "#F0ECFA",
      danger: "#E35D68",
      dangerText: "#D64545",
      dangerSubtle: "#FDF0F1",
      warning: "#F3C623",
      warningText: "#514A16",
      warningSubtle: "#FFF5C9",
      info: "#3B6AE0",
      infoText: "#1E40AF",
      infoSubtle: "#EFF4FF",
      inputBg: "#FFFFFF",
      inputBorder: "#E8E8EC",
      placeholder: "#6B6C74",
      sidebar: "#1C1C3A",
      sidebarForeground: "#FFFFFF",
      sidebarMuted: "#B8B4D4",
      sidebarHover: "#2A2A46",
      sidebarActive: "#342C5B",
      sidebarBorder: "#3A3343",
      header: "#FFFFFF",
      tableHeader: "#F3F4F6",
      tableHover: "#F7F4FC",
      tableSelected: "#F0ECFA",
      tooltipBg: "#14151A",
      tooltipText: "#F2F2F5",
      tooltipBorder: "#3A3343",
      chartGrid: "#ECEDEF",
      chartAxis: "#85868E",
      chartProfit: "#40C79A",
      chartProfitSoft: "#D8F3E8",
      chartLoss: "#F26969",
      chartLossSoft: "#F8DDE0",
      chartLine: "#4B438B",
      chartSeries: "#3B6AE0",
      chartDrawdown: "#D64545",
      skeleton: "#E7E8EC",
      scrollbar: "#B7B7C0",
    }
  );
  theme.chrome = {
    overlay: LIGHT_SHADOW.overlay,
    focusRing: "0 0 0 2px #5B469626",
    shadowSm: "0 1px 3px rgba(20, 20, 30, 0.04)",
    shadowMd: "0 2px 8px rgba(20, 20, 30, 0.03)",
    shadowDropdown: "0 8px 24px rgba(20, 20, 30, 0.1)",
  };
  return theme;
}

/** Hand-authored channels and split hex from the original light theme. */
const ORIGINAL_DEFAULT_CSS: Record<string, string> = {
  "--background": "200 11% 95%",
  "--foreground": "240 10% 9%",
  "--surface": "0 0% 100%",
  "--surface-2": "220 14% 96%",
  "--card": "0 0% 100%",
  "--border": "240 8% 92%",
  "--primary": "255 36% 43%",
  "--primary-foreground": "0 0% 100%",
  "--accent": "255 36% 43%",
  "--ring": "255 36% 43%",
  "--muted": "233 5% 36%",
  "--sidebar": "240 35% 17%",
  "--sidebar-foreground": "0 0% 100%",
  "--sidebar-muted": "248 27% 77%",
  "--sidebar-border": "240 22% 22%",
  "--positive": "255 36% 43%",
  "--positive-soft": "255 36% 94%",
  "--negative": "355 71% 63%",
  "--negative-soft": "355 67% 97%",
  "--destructive": "355 71% 63%",
  "--accent-hex": "#5B4696",
  "--color-primary": "#5B4696",
  "--color-primary-hover": "#4F3C87",
  "--color-primary-active": "#49377D",
  "--color-primary-light": "#F0ECFA",
  "--color-primary-very-light": "#F7F4FC",
  "--color-background": "#F2F4F5",
  "--color-background-subtle": "#FEFEFE",
  "--color-surface": "#FFFFFF",
  "--color-surface-secondary": "#FEFEFE",
  "--color-surface-elevated": "#FFFFFF",
  "--color-border": "#E8E8EC",
  "--color-border-light": "#EEEEF1",
  "--color-border-subtle": "#ECECF0",
  "--color-divider": "#ECECF0",
  "--color-text-primary": "#14151A",
  "--color-text-secondary": "#4A4B52",
  "--color-text-tertiary": "#6B6C74",
  "--color-text-muted": "#85868E",
  "--color-text-kpi": "#111218",
  "--color-text-label": "#4F5058",
  "--color-success": "#5B4696",
  "--color-success-dark": "#4F3C87",
  "--color-success-text": "#2F9E6A",
  "--color-success-bg": "#F0ECFA",
  "--color-success-light": "#F7F4FC",
  "--color-danger": "#E35D68",
  "--color-danger-dark": "#D94D59",
  "--color-danger-text": "#D64545",
  "--color-danger-light": "#F8DDE0",
  "--color-danger-bg": "#FDF0F1",
  "--color-warning": "#F3C623",
  "--color-warning-text": "#514A16",
  "--color-warning-bg": "#FFF5C9",
  "--color-warning-badge": "#F4D34F",
  "--color-warning-badge-text": "#514A16",
  "--color-chart-grid": "#ECEDEF",
  "--color-chart-axis": "#85868E",
  "--color-chart-line": "#4B438B",
  "--color-chart-profit": "#40C79A",
  "--color-chart-loss": "#F26969",
  "--color-chart-series": "#3B6AE0",
  "--color-gauge-track": "#E7E8EC",
  "--color-breakeven": "#7B8DB8",
  "--color-sidebar": "#1C1C3A",
  "--color-sidebar-text": "#FFFFFF",
  "--color-sidebar-secondary": "#C7C2D0",
  "--color-sidebar-icon": "#AAA4B5",
  "--color-sidebar-hover": "rgba(255, 255, 255, 0.06)",
  "--color-sidebar-active": "rgba(124, 92, 191, 0.25)",
  "--color-sidebar-indicator": "#A78BFA",
  "--color-sidebar-divider": "#3A3343",
  "--color-negative-hex": "#E35D68",
  "--focus-ring": "0 0 0 2px #5B469626",
  "--shadow-sm": "0 1px 3px rgba(20, 20, 30, 0.04)",
  "--shadow-md": "0 2px 8px rgba(20, 20, 30, 0.03)",
  "--shadow-dropdown": "0 8px 24px rgba(20, 20, 30, 0.1)",
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  "tradefix-purple": originalDefaultPreset(),
  classic: preset(
    "classic",
    "TradeFix Classic",
    "Clean light interface with violet accents.",
    "light",
    {
      background: "#F3F4F6",
      backgroundSubtle: "#FCFCFC",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#F9FAFB",
      surfaceSelected: "#E0E7FF",
      textPrimary: "#111827",
      textSecondary: "#4B5563",
      textMuted: "#4B5563",
      textInverse: "#FFFFFF",
      textDisabled: "#4B5563",
      border: "#E5E7EB",
      borderStrong: "#D1D5DB",
      borderSubtle: "#EEF0F3",
      divider: "#E5E7EB",
      primary: "#4F46E5",
      primaryHover: "#4338CA",
      primaryActive: "#3730A3",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#E0E7FF",
      success: "#40C79A",
      successText: "#047857",
      successSubtle: "#ECFDF5",
      danger: "#F26969",
      dangerText: "#B91C1C",
      dangerSubtle: "#FEF2F2",
      warning: "#D97706",
      warningText: "#92400E",
      warningSubtle: "#FFFBEB",
      info: "#2563EB",
      infoText: "#1D4ED8",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFFFF",
      inputBorder: "#D1D5DB",
      placeholder: "#4B5563",
      sidebar: "#FFFFFF",
      sidebarForeground: "#111827",
      sidebarMuted: "#4B5563",
      sidebarHover: "#F3F4F6",
      sidebarActive: "#E0E7FF",
      sidebarBorder: "#E5E7EB",
      header: "#FFFFFF",
      tableHeader: "#F9FAFB",
      tableHover: "#F3F4F6",
      tableSelected: "#E0E7FF",
      tooltipBg: "#111827",
      tooltipText: "#F9FAFB",
      tooltipBorder: "#374151",
      chartGrid: "#E5E7EB",
      chartAxis: "#4B5563",
      chartProfit: "#40C79A",
      chartProfitSoft: "#B7EAD9",
      chartLoss: "#F26969",
      chartLossSoft: "#FAC7C7",
      chartLine: "#4F46E5",
      chartSeries: "#2563EB",
      chartDrawdown: "#B91C1C",
      skeleton: "#E5E7EB",
      scrollbar: "#C4C8D0",
    }
  ),
  "midnight-pro": preset(
    "midnight-pro",
    "Midnight Pro",
    "Refined dark interface for focused trading analysis.",
    "dark",
    {
      background: "#0B1220",
      backgroundSubtle: "#0F172A",
      surface: "#111827",
      surfaceElevated: "#1F2937",
      surfaceMuted: "#172235",
      surfaceSelected: "#312E81",
      textPrimary: "#F9FAFB",
      textSecondary: "#CBD5E1",
      textMuted: "#9CA3AF",
      textInverse: "#0F172A",
      textDisabled: "#94A3B8",
      border: "#374151",
      borderStrong: "#4B5563",
      borderSubtle: "#1F2937",
      divider: "#374151",
      primary: "#818CF8",
      primaryHover: "#A5B4FC",
      primaryActive: "#C7D2FE",
      primaryForeground: "#0F172A",
      primarySubtle: "#312E81",
      success: "#34D399",
      successText: "#6EE7B7",
      successSubtle: "#064E3B",
      danger: "#FB7185",
      dangerText: "#FDA4AF",
      dangerSubtle: "#4C1D2B",
      warning: "#FBBF24",
      warningText: "#FDE68A",
      warningSubtle: "#451A03",
      info: "#60A5FA",
      infoText: "#BFDBFE",
      infoSubtle: "#1E3A8A",
      inputBg: "#111827",
      inputBorder: "#4B5563",
      placeholder: "#94A3B8",
      sidebar: "#0B1220",
      sidebarForeground: "#F9FAFB",
      sidebarMuted: "#CBD5E1",
      sidebarHover: "#172235",
      sidebarActive: "#312E81",
      sidebarBorder: "#1F2937",
      header: "#111827",
      tableHeader: "#172235",
      tableHover: "#172235",
      tableSelected: "#312E81",
      tooltipBg: "#1F2937",
      tooltipText: "#F9FAFB",
      tooltipBorder: "#4B5563",
      chartGrid: "#374151",
      chartAxis: "#CBD5E1",
      chartProfit: "#34D399",
      chartProfitSoft: "#064E3B",
      chartLoss: "#FB7185",
      chartLossSoft: "#4C1D2B",
      chartLine: "#A5B4FC",
      chartSeries: "#60A5FA",
      chartDrawdown: "#FDA4AF",
      skeleton: "#1F2937",
      scrollbar: "#4B5563",
    }
  ),
  "ocean-blue": preset(
    "ocean-blue",
    "Ocean Blue",
    "Cool blue surfaces with professional accents.",
    "light",
    {
      background: "#F3F8FE",
      backgroundSubtle: "#F8FBFF",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#EAF2FC",
      surfaceSelected: "#DBEAFE",
      textPrimary: "#172033",
      textSecondary: "#52647A",
      textMuted: "#52647A",
      textInverse: "#FFFFFF",
      textDisabled: "#3E5270",
      border: "#D6E2F0",
      borderStrong: "#B7C9DE",
      borderSubtle: "#E6EEF7",
      divider: "#D6E2F0",
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      primaryActive: "#1E40AF",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#DBEAFE",
      success: "#0F9D78",
      successText: "#047857",
      successSubtle: "#ECFDF5",
      danger: "#C2415D",
      dangerText: "#9F1239",
      dangerSubtle: "#FFF1F2",
      warning: "#B45309",
      warningText: "#92400E",
      warningSubtle: "#FFFBEB",
      info: "#1D4ED8",
      infoText: "#1E3A8A",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFFFF",
      inputBorder: "#B7C9DE",
      placeholder: "#52647A",
      sidebar: "#FFFFFF",
      sidebarForeground: "#172033",
      sidebarMuted: "#52647A",
      sidebarHover: "#EAF2FC",
      sidebarActive: "#DBEAFE",
      sidebarBorder: "#D6E2F0",
      header: "#FFFFFF",
      tableHeader: "#EAF2FC",
      tableHover: "#F3F8FE",
      tableSelected: "#DBEAFE",
      tooltipBg: "#172033",
      tooltipText: "#F8FBFF",
      tooltipBorder: "#3E5270",
      chartGrid: "#D6E2F0",
      chartAxis: "#3E5270",
      chartProfit: "#0F9D78",
      chartProfitSoft: "#C7F0E4",
      chartLoss: "#C2415D",
      chartLossSoft: "#F8D0D8",
      chartLine: "#2563EB",
      chartSeries: "#0369A1",
      chartDrawdown: "#9F1239",
      skeleton: "#E2EAF5",
      scrollbar: "#B7C9DE",
    }
  ),
  "forest-green": preset(
    "forest-green",
    "Forest Green",
    "Natural greens and calm surfaces.",
    "light",
    {
      background: "#F3F7F3",
      backgroundSubtle: "#F8FBF8",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#EAF1EA",
      surfaceSelected: "#DCFCE7",
      textPrimary: "#17251B",
      textSecondary: "#3F5344",
      textMuted: "#3F5344",
      textInverse: "#FFFFFF",
      textDisabled: "#3F5344",
      border: "#D6E2D6",
      borderStrong: "#B7C9B8",
      borderSubtle: "#E7F0E7",
      divider: "#D6E2D6",
      primary: "#166534",
      primaryHover: "#14532D",
      primaryActive: "#052E16",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#DCFCE7",
      success: "#15803D",
      successText: "#14532D",
      successSubtle: "#F0FDF4",
      danger: "#B91C1C",
      dangerText: "#991B1B",
      dangerSubtle: "#FEF2F2",
      warning: "#A16207",
      warningText: "#854D0E",
      warningSubtle: "#FFFBEB",
      info: "#1D4ED8",
      infoText: "#1E3A8A",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFFFF",
      inputBorder: "#B7C9B8",
      placeholder: "#3F5344",
      sidebar: "#FFFFFF",
      sidebarForeground: "#17251B",
      sidebarMuted: "#3F5344",
      sidebarHover: "#EAF1EA",
      sidebarActive: "#DCFCE7",
      sidebarBorder: "#D6E2D6",
      header: "#FFFFFF",
      tableHeader: "#EAF1EA",
      tableHover: "#F3F7F3",
      tableSelected: "#DCFCE7",
      tooltipBg: "#17251B",
      tooltipText: "#F8FBF8",
      tooltipBorder: "#3F5344",
      chartGrid: "#D6E2D6",
      chartAxis: "#3F5344",
      chartProfit: "#15803D",
      chartProfitSoft: "#BBF7D0",
      chartLoss: "#B91C1C",
      chartLossSoft: "#FECACA",
      chartLine: "#166534",
      chartSeries: "#1D4ED8",
      chartDrawdown: "#991B1B",
      skeleton: "#E3EBE3",
      scrollbar: "#B7C9B8",
    }
  ),
  amethyst: preset(
    "amethyst",
    "Amethyst",
    "Elegant purple tones and soft lavender backgrounds.",
    "light",
    {
      background: "#F7F5FC",
      backgroundSubtle: "#FBFAFE",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#F0EBFA",
      surfaceSelected: "#EDE9FE",
      textPrimary: "#241C33",
      textSecondary: "#5C536E",
      textMuted: "#5C536E",
      textInverse: "#FFFFFF",
      textDisabled: "#5C536E",
      border: "#E3DAF4",
      borderStrong: "#CDBFE6",
      borderSubtle: "#F1ECF8",
      divider: "#E3DAF4",
      primary: "#6D28D9",
      primaryHover: "#5B21B6",
      primaryActive: "#4C1D95",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#EDE9FE",
      success: "#0F8B72",
      successText: "#047857",
      successSubtle: "#ECFDF5",
      danger: "#C2415D",
      dangerText: "#9F1239",
      dangerSubtle: "#FFF1F2",
      warning: "#A16207",
      warningText: "#854D0E",
      warningSubtle: "#FFFBEB",
      info: "#5B21B6",
      infoText: "#4C1D95",
      infoSubtle: "#F5F3FF",
      inputBg: "#FFFFFF",
      inputBorder: "#CDBFE6",
      placeholder: "#5C536E",
      sidebar: "#FFFFFF",
      sidebarForeground: "#241C33",
      sidebarMuted: "#5C536E",
      sidebarHover: "#F0EBFA",
      sidebarActive: "#EDE9FE",
      sidebarBorder: "#E3DAF4",
      header: "#FFFFFF",
      tableHeader: "#F0EBFA",
      tableHover: "#F7F5FC",
      tableSelected: "#EDE9FE",
      tooltipBg: "#241C33",
      tooltipText: "#FBFAFE",
      tooltipBorder: "#5C536E",
      chartGrid: "#E3DAF4",
      chartAxis: "#5C536E",
      chartProfit: "#0F8B72",
      chartProfitSoft: "#C7F0E6",
      chartLoss: "#C2415D",
      chartLossSoft: "#F8D0D8",
      chartLine: "#6D28D9",
      chartSeries: "#5B21B6",
      chartDrawdown: "#9F1239",
      skeleton: "#E8E1F3",
      scrollbar: "#CDBFE6",
    }
  ),
  "warm-sand": preset(
    "warm-sand",
    "Warm Sand",
    "Warm neutrals and understated earthy accents.",
    "light",
    {
      background: "#F8F5EF",
      backgroundSubtle: "#FFFEFB",
      surface: "#FFFEFB",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#F1ECE2",
      surfaceSelected: "#F3E4D2",
      textPrimary: "#29251F",
      textSecondary: "#5C5348",
      textMuted: "#5C5348",
      textInverse: "#FFFEFB",
      textDisabled: "#5C5348",
      border: "#E5DCCF",
      borderStrong: "#D3C6B4",
      borderSubtle: "#F1ECE2",
      divider: "#E5DCCF",
      primary: "#8B5E34",
      primaryHover: "#6E4728",
      primaryActive: "#5C3A20",
      primaryForeground: "#FFFEFB",
      primarySubtle: "#F3E4D2",
      success: "#18794E",
      successText: "#145C3C",
      successSubtle: "#ECFDF5",
      danger: "#B93838",
      dangerText: "#991B1B",
      dangerSubtle: "#FEF2F2",
      warning: "#925F0D",
      warningText: "#78350F",
      warningSubtle: "#FFFBEB",
      info: "#315F9D",
      infoText: "#1E3A8A",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFEFB",
      inputBorder: "#D3C6B4",
      placeholder: "#5C5348",
      sidebar: "#FFFEFB",
      sidebarForeground: "#29251F",
      sidebarMuted: "#5C5348",
      sidebarHover: "#F1ECE2",
      sidebarActive: "#F3E4D2",
      sidebarBorder: "#E5DCCF",
      header: "#FFFEFB",
      tableHeader: "#F1ECE2",
      tableHover: "#F8F5EF",
      tableSelected: "#F3E4D2",
      tooltipBg: "#29251F",
      tooltipText: "#FFFEFB",
      tooltipBorder: "#5C5348",
      chartGrid: "#E5DCCF",
      chartAxis: "#5C5348",
      chartProfit: "#18794E",
      chartProfitSoft: "#C6E8D6",
      chartLoss: "#B93838",
      chartLossSoft: "#F4C9C9",
      chartLine: "#6E4728",
      chartSeries: "#315F9D",
      chartDrawdown: "#991B1B",
      skeleton: "#E8E0D4",
      scrollbar: "#D3C6B4",
    }
  ),
  "obsidian-gold": preset(
    "obsidian-gold",
    "Obsidian Gold",
    "Deep obsidian surfaces with champagne-gold actions.",
    "dark",
    {
      background: "#0A0A0C",
      backgroundSubtle: "#111111",
      surface: "#111111",
      surfaceElevated: "#1A1A1A",
      surfaceMuted: "#252525",
      surfaceSelected: "#302819",
      textPrimary: "#F5F0E1",
      textSecondary: "#C9C2B1",
      textMuted: "#A39B8B",
      textInverse: "#0A0A0C",
      textDisabled: "#A39B8B",
      border: "#333333",
      borderStrong: "#4A4A4A",
      borderSubtle: "#252525",
      divider: "#333333",
      primary: "#BEA064",
      primaryHover: "#D0C09A",
      primaryActive: "#A88B4F",
      primaryForeground: "#0A0A0C",
      primarySubtle: "#302819",
      success: "#34D399",
      successText: "#34D399",
      successSubtle: "#064E3B",
      danger: "#FB7185",
      dangerText: "#FB7185",
      dangerSubtle: "#4C1D2B",
      warning: "#FBBF24",
      warningText: "#FDE68A",
      warningSubtle: "#451A03",
      info: "#60A5FA",
      infoText: "#BFDBFE",
      infoSubtle: "#1E3A8A",
      inputBg: "#111111",
      inputBorder: "#333333",
      placeholder: "#A39B8B",
      sidebar: "#0A0A0C",
      sidebarForeground: "#F5F0E1",
      sidebarMuted: "#C9C2B1",
      sidebarHover: "#1A1A1A",
      sidebarActive: "#302819",
      sidebarBorder: "#333333",
      header: "#111111",
      tableHeader: "#1A1A1A",
      tableHover: "#1A1A1A",
      tableSelected: "#302819",
      tooltipBg: "#1A1A1A",
      tooltipText: "#F5F0E1",
      tooltipBorder: "#333333",
      chartGrid: "#333333",
      chartAxis: "#C9C2B1",
      chartProfit: "#34D399",
      chartProfitSoft: "#064E3B",
      chartLoss: "#FB7185",
      chartLossSoft: "#4C1D2B",
      chartLine: "#D0C09A",
      chartSeries: "#60A5FA",
      chartDrawdown: "#FDA4AF",
      skeleton: "#252525",
      scrollbar: "#4A4A4A",
    }
  ),
  "emerald-luxe": preset(
    "emerald-luxe",
    "Emerald Luxe",
    "Cream surfaces with deep emerald actions and restrained gold.",
    "light",
    {
      background: "#F3F7F2",
      backgroundSubtle: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#E7EFE8",
      surfaceSelected: "#DCE8DD",
      textPrimary: "#18251C",
      textSecondary: "#536458",
      textMuted: "#536458",
      textInverse: "#FFFFFF",
      textDisabled: "#536458",
      border: "#D5E1D6",
      borderStrong: "#B7C9B9",
      borderSubtle: "#E7EFE8",
      divider: "#D5E1D6",
      primary: "#14532D",
      primaryHover: "#114727",
      primaryActive: "#0C341C",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#DCE8DD",
      success: "#40C79A",
      successText: "#047857",
      successSubtle: "#ECFDF5",
      danger: "#F26969",
      dangerText: "#B91C1C",
      dangerSubtle: "#FEF2F2",
      warning: "#B45309",
      warningText: "#92400E",
      warningSubtle: "#FFFBEB",
      info: "#1D4ED8",
      infoText: "#1E40AF",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFFFF",
      inputBorder: "#D5E1D6",
      placeholder: "#536458",
      sidebar: "#FFFFFF",
      sidebarForeground: "#18251C",
      sidebarMuted: "#536458",
      sidebarHover: "#E7EFE8",
      sidebarActive: "#DCE8DD",
      sidebarBorder: "#D5E1D6",
      header: "#FFFFFF",
      tableHeader: "#E7EFE8",
      tableHover: "#F3F7F2",
      tableSelected: "#DCE8DD",
      tooltipBg: "#18251C",
      tooltipText: "#F8FBF8",
      tooltipBorder: "#3F5344",
      chartGrid: "#D5E1D6",
      chartAxis: "#536458",
      chartProfit: "#40C79A",
      chartProfitSoft: "#C6E8D6",
      chartLoss: "#F26969",
      chartLossSoft: "#F4C9C9",
      chartLine: "#8C6A3A",
      chartSeries: "#1D4ED8",
      chartDrawdown: "#B91C1C",
      skeleton: "#E7EFE8",
      scrollbar: "#C5D4C7",
    }
  ),
  "burgundy-champagne": preset(
    "burgundy-champagne",
    "Burgundy Champagne",
    "Ivory surfaces with burgundy actions and champagne details.",
    "light",
    {
      background: "#FAF6F5",
      backgroundSubtle: "#FFFEFD",
      surface: "#FFFEFD",
      surfaceElevated: "#FFFEFD",
      surfaceMuted: "#F2E7E8",
      surfaceSelected: "#F3E5E7",
      textPrimary: "#2A1D20",
      textSecondary: "#69585D",
      textMuted: "#69585D",
      textInverse: "#FFFFFF",
      textDisabled: "#69585D",
      border: "#E6D7DA",
      borderStrong: "#D4C0C4",
      borderSubtle: "#F2E7E8",
      divider: "#E6D7DA",
      primary: "#6B1024",
      primaryHover: "#4C0B1A",
      primaryActive: "#3A0712",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#F3E5E7",
      success: "#40C79A",
      successText: "#047857",
      successSubtle: "#ECFDF5",
      danger: "#F26969",
      dangerText: "#BE3A3A",
      dangerSubtle: "#FEF2F2",
      warning: "#B45309",
      warningText: "#92400E",
      warningSubtle: "#FFFBEB",
      info: "#1D4ED8",
      infoText: "#1E40AF",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFEFD",
      inputBorder: "#E6D7DA",
      placeholder: "#69585D",
      sidebar: "#FFFEFD",
      sidebarForeground: "#2A1D20",
      sidebarMuted: "#69585D",
      sidebarHover: "#F2E7E8",
      sidebarActive: "#F3E5E7",
      sidebarBorder: "#E6D7DA",
      header: "#FFFEFD",
      tableHeader: "#F2E7E8",
      tableHover: "#FAF6F5",
      tableSelected: "#F3E5E7",
      tooltipBg: "#2A1D20",
      tooltipText: "#FFFEFB",
      tooltipBorder: "#5C474C",
      chartGrid: "#E6D7DA",
      chartAxis: "#69585D",
      chartProfit: "#40C79A",
      chartProfitSoft: "#C6E8D6",
      chartLoss: "#F26969",
      chartLossSoft: "#F4C9C9",
      chartLine: "#8C6A3A",
      chartSeries: "#1D4ED8",
      chartDrawdown: "#9F1239",
      skeleton: "#F2E7E8",
      scrollbar: "#DCC8CB",
    }
  ),
  "violet-aurora": preset(
    "violet-aurora",
    "Violet Aurora",
    "A vibrant purple theme with luminous lavender accents.",
    "light",
    {
      background: "#F8F6FF",
      backgroundSubtle: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#F1EBFF",
      surfaceSelected: "#EDE5FF",
      textPrimary: "#24113F",
      textSecondary: "#5B4B74",
      textMuted: "#706184",
      textInverse: "#FFFFFF",
      textDisabled: "#706184",
      border: "#E5DDF7",
      borderStrong: "#C4B5FD",
      borderSubtle: "#E5DDF7",
      divider: "#E5DDF7",
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      primaryActive: "#5B21B6",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#EDE5FF",
      success: "#166534",
      successText: "#166534",
      successSubtle: "#ECFDF5",
      danger: "#B91C1C",
      dangerText: "#B91C1C",
      dangerSubtle: "#FEF2F2",
      warning: "#92400E",
      warningText: "#92400E",
      warningSubtle: "#FFFBEB",
      info: "#1D4ED8",
      infoText: "#1D4ED8",
      infoSubtle: "#EFF6FF",
      inputBg: "#FFFFFF",
      inputBorder: "#C4B5FD",
      placeholder: "#706184",
      sidebar: "#FFFFFF",
      sidebarForeground: "#24113F",
      sidebarMuted: "#706184",
      sidebarHover: "#F1EBFF",
      sidebarActive: "#EDE5FF",
      sidebarBorder: "#E5DDF7",
      header: "#FFFFFF",
      tableHeader: "#F1EBFF",
      tableHover: "#F8F6FF",
      tableSelected: "#EDE5FF",
      tooltipBg: "#FFFFFF",
      tooltipText: "#24113F",
      tooltipBorder: "#E5DDF7",
      chartGrid: "#E9E2F5",
      chartAxis: "#5B4B74",
      chartProfit: "#34D399",
      chartProfitSoft: "#D1FAE5",
      chartLoss: "#F87171",
      chartLossSoft: "#FECACA",
      chartLine: "#7C3AED",
      chartSeries: "#9333EA",
      chartDrawdown: "#B91C1C",
      skeleton: "#F1EBFF",
      scrollbar: "#C4B5FD",
    },
    {
      overlay: "rgba(36, 17, 63, 0.45)",
      focusRing: "0 0 0 2px #7C3AED",
      shadowSm: "0 1px 2px rgba(91, 33, 182, 0.06), 0 1px 3px rgba(36, 17, 63, 0.04)",
      shadowMd: "0 4px 16px rgba(91, 33, 182, 0.08)",
      shadowDropdown: "0 12px 32px rgba(36, 17, 63, 0.12)",
    }
  ),
  "electric-spectrum": preset(
    "electric-spectrum",
    "Electric Spectrum",
    "Vibrant blue-to-violet gradients with luminous magenta accents.",
    "light",
    {
      background: "#F7F8FF",
      backgroundSubtle: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceMuted: "#F0F3FF",
      surfaceSelected: "#E9E8FF",
      textPrimary: "#171B3B",
      textSecondary: "#515A78",
      textMuted: "#676E87",
      textInverse: "#FFFFFF",
      textDisabled: "#676E87",
      border: "#E0E4F5",
      borderStrong: "#C9D0EB",
      borderSubtle: "#E0E4F5",
      divider: "#E0E4F5",
      primary: "#4F46E5",
      primaryHover: "#4338CA",
      primaryActive: "#3730A3",
      primaryForeground: "#FFFFFF",
      primarySubtle: "#E9E8FF",
      success: "#047857",
      successText: "#047857",
      successSubtle: "#D8F6EB",
      danger: "#B91C1C",
      dangerText: "#B91C1C",
      dangerSubtle: "#FEE2E2",
      warning: "#92400E",
      warningText: "#92400E",
      warningSubtle: "#FEF3C7",
      info: "#1D4ED8",
      infoText: "#1D4ED8",
      infoSubtle: "#DBEAFE",
      inputBg: "#FFFFFF",
      inputBorder: "#C9D0EB",
      placeholder: "#676E87",
      sidebar: "#FFFFFF",
      sidebarForeground: "#171B3B",
      sidebarMuted: "#676E87",
      sidebarHover: "#F3EDFF",
      sidebarActive: "#E9E8FF",
      sidebarBorder: "#E0E4F5",
      header: "#FFFFFF",
      tableHeader: "#F0F3FF",
      tableHover: "#F3EDFF",
      tableSelected: "#E9E8FF",
      tooltipBg: "#FFFFFF",
      tooltipText: "#171B3B",
      tooltipBorder: "#DDE2F3",
      chartGrid: "#E5E7F3",
      chartAxis: "#68718C",
      chartProfit: "#34C79A",
      chartProfitSoft: "#D8F6EB",
      chartLoss: "#F87171",
      chartLossSoft: "#FEE2E2",
      chartLine: "#5B4BEB",
      chartSeries: "#3987FF",
      chartDrawdown: "#B91C1C",
      skeleton: "#E9E8FF",
      scrollbar: "#C9D0EB",
    },
    {
      overlay: "rgba(23, 27, 59, 0.45)",
      focusRing: "0 0 0 2px #4F46E5",
      shadowSm: "0 1px 2px rgba(104, 48, 255, 0.06), 0 1px 3px rgba(23, 27, 59, 0.04)",
      shadowMd: "0 4px 16px rgba(104, 48, 255, 0.08)",
      shadowDropdown: "0 12px 32px rgba(23, 27, 59, 0.12)",
    }
  ),
};

export const THEME_GROUPS: { label: string; ids: ThemePresetId[] }[] = [
  { label: "TradeFix", ids: ["tradefix-purple", "classic"] },
  { label: "Professional", ids: ["midnight-pro", "ocean-blue", "forest-green", "amethyst", "warm-sand"] },
  { label: "Luxury", ids: ["obsidian-gold", "emerald-luxe", "burgundy-champagne", "violet-aurora", "electric-spectrum"] },
];

export const THEME_ORDER: ThemePresetId[] = THEME_GROUPS.flatMap((group) => group.ids);

/** Tailwind utilities read these as `hsl(var(--token) / alpha)`, so values must be channels. */
export const HSL_CHANNEL_VARS: Record<string, keyof ThemeTokens> = {
  "--background": "background",
  "--foreground": "textPrimary",
  "--surface": "surface",
  "--surface-2": "surfaceMuted",
  "--card": "surfaceElevated",
  "--border": "border",
  "--primary": "primary",
  "--primary-foreground": "primaryForeground",
  "--accent": "primary",
  "--ring": "primary",
  "--muted": "textMuted",
  "--sidebar": "sidebar",
  "--sidebar-foreground": "sidebarForeground",
  "--sidebar-muted": "sidebarMuted",
  "--sidebar-border": "sidebarBorder",
  "--positive": "successText",
  "--positive-soft": "successSubtle",
  "--negative": "dangerText",
  "--negative-soft": "dangerSubtle",
  "--destructive": "dangerText",
};

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && (THEME_PRESET_IDS as readonly string[]).includes(value);
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Saved custom themes use this id. The palette itself is not stored in `users.theme`. */
export const CUSTOM_THEME_ID_PATTERN = /^ct_[a-f0-9]{12}$/;

export function isCustomThemeId(value: unknown): value is string {
  return typeof value === "string" && CUSTOM_THEME_ID_PATTERN.test(value);
}

/** Legacy light/dark become explicit presets. `system` stays Follow device. Saved preset and custom ids are kept. */
export function migrateStoredTheme(value: unknown): string {
  if (value === "dark") return "midnight-pro";
  if (value === "light") return DEFAULT_THEME_ID;
  if (value === "system") return "system";
  if (isThemePresetId(value)) return value;
  if (isCustomThemeId(value)) return value;
  return DEFAULT_THEME_ID;
}

export function resolveTheme(preference: string, systemDark: boolean): ThemePresetId {
  if (preference === "system") return systemDark ? "midnight-pro" : "classic";
  if (isThemePresetId(preference)) return preference;
  return DEFAULT_THEME_ID;
}

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToHslChannels(hex: string): string {
  const { r, g, b } = parseHex(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function channelToUnit(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * channelToUnit(r) + 0.7152 * channelToUnit(g) + 0.0722 * channelToUnit(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hslChannelsToHex(channels: string): string {
  const match = channels.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) throw new Error(`Invalid HSL channels: ${channels}`);
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return rgbToHex(v, v, v);
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** CSS custom properties for one preset. Channel slots never contain hex. */
export function cssVariablesFor(presetId: ThemePresetId): Record<string, string> {
  const presetDef = THEME_PRESETS[presetId];
  const tokens = presetDef.tokens;
  const vars: Record<string, string> = {};
  for (const [name, key] of Object.entries(HSL_CHANNEL_VARS)) {
    vars[name] = hexToHslChannels(tokens[key]);
  }
  const hex: Record<string, string> = {
    "--color-background": tokens.background,
    "--color-background-subtle": tokens.backgroundSubtle,
    "--color-surface": tokens.surface,
    "--color-surface-secondary": tokens.surfaceMuted,
    "--color-surface-elevated": tokens.surfaceElevated,
    "--color-surface-muted": tokens.surfaceMuted,
    "--color-surface-selected": tokens.surfaceSelected,
    "--color-text-primary": tokens.textPrimary,
    "--color-text-secondary": tokens.textSecondary,
    "--color-text-tertiary": tokens.textMuted,
    "--color-text-muted": tokens.textMuted,
    "--color-text-inverse": tokens.textInverse,
    "--color-text-disabled": tokens.textDisabled,
    "--color-text-kpi": tokens.textPrimary,
    "--color-text-label": tokens.textSecondary,
    "--color-border": tokens.border,
    "--color-border-strong": tokens.borderStrong,
    "--color-border-light": tokens.borderSubtle,
    "--color-border-subtle": tokens.borderSubtle,
    "--color-divider": tokens.divider,
    "--color-primary": tokens.primary,
    "--color-primary-hover": tokens.primaryHover,
    "--color-primary-active": tokens.primaryActive,
    "--color-primary-foreground": tokens.primaryForeground,
    "--color-primary-light": tokens.primarySubtle,
    "--color-primary-very-light": tokens.primarySubtle,
    "--accent-hex": tokens.primary,
    "--color-success": tokens.success,
    "--color-success-text": tokens.successText,
    "--color-success-bg": tokens.successSubtle,
    "--color-success-light": tokens.successSubtle,
    "--color-danger": tokens.danger,
    "--color-danger-text": tokens.dangerText,
    "--color-danger-bg": tokens.dangerSubtle,
    "--color-danger-light": tokens.dangerSubtle,
    "--color-warning": tokens.warning,
    "--color-warning-text": tokens.warningText,
    "--color-warning-bg": tokens.warningSubtle,
    "--color-warning-badge": tokens.warningSubtle,
    "--color-warning-badge-text": tokens.warningText,
    "--color-info": tokens.info,
    "--color-info-text": tokens.infoText,
    "--color-info-bg": tokens.infoSubtle,
    "--color-input-bg": tokens.inputBg,
    "--color-input-border": tokens.inputBorder,
    "--color-placeholder": tokens.placeholder,
    "--color-sidebar": tokens.sidebar,
    "--color-sidebar-text": tokens.sidebarForeground,
    "--color-sidebar-hover": tokens.sidebarHover,
    "--color-sidebar-active": tokens.sidebarActive,
    "--color-header": tokens.header,
    "--color-table-header": tokens.tableHeader,
    "--color-table-hover": tokens.tableHover,
    "--color-table-selected": tokens.tableSelected,
    "--color-tooltip-bg": tokens.tooltipBg,
    "--color-tooltip-text": tokens.tooltipText,
    "--color-tooltip-border": tokens.tooltipBorder,
    "--color-chart-grid": tokens.chartGrid,
    "--color-chart-axis": tokens.chartAxis,
    "--color-chart-profit": tokens.chartProfit,
    "--color-chart-profit-soft": tokens.chartProfitSoft,
    "--color-chart-loss": tokens.chartLoss,
    "--color-chart-loss-soft": tokens.chartLossSoft,
    "--color-chart-line": tokens.chartLine,
    "--color-chart-series": tokens.chartSeries,
    "--color-chart-drawdown": tokens.chartDrawdown,
    "--color-gauge-track": tokens.skeleton,
    "--color-skeleton": tokens.skeleton,
    "--color-scrollbar": tokens.scrollbar,
    "--color-overlay": presetDef.chrome.overlay,
    "--shadow-sm": presetDef.chrome.shadowSm,
    "--shadow-md": presetDef.chrome.shadowMd,
    "--shadow-dropdown": presetDef.chrome.shadowDropdown,
    "--focus-ring": presetDef.chrome.focusRing,
  };
  Object.assign(vars, hex);
  if (presetId === "tradefix-purple") {
    Object.assign(vars, ORIGINAL_DEFAULT_CSS);
    return vars;
  }
  // These lived on :root and were shared. Pin the previous values so the
  // restored default stylesheet does not leak into the other presets.
  vars["--color-sidebar-icon"] = "#C7C2D0";
  vars["--color-sidebar-secondary"] = "#C7C2D0";
  vars["--color-sidebar-divider"] = "#3A3343";
  vars["--color-breakeven"] = "#6B6C74";
  vars["--color-success-dark"] = "#18794E";
  vars["--color-danger-dark"] = "#BE3A3A";
  vars["--color-negative-hex"] = tokens.chartLoss;
  vars["--color-sidebar-indicator"] = tokens.primary;
  if (presetId === "violet-aurora") {
    vars["--aurora-gradient"] = "linear-gradient(135deg, #5B21B6 0%, #7C3AED 55%, #9333EA 100%)";
    vars["--aurora-gradient-hover"] = "linear-gradient(135deg, #5B21B6 0%, #6D28D9 48%, #7C3AED 100%)";
    vars["--aurora-glow"] = "0 8px 18px rgba(124, 58, 237, 0.22)";
    vars["--color-luminous"] = "#C4B5FD";
    vars["--color-sidebar-icon"] = tokens.sidebarMuted;
    vars["--color-sidebar-secondary"] = tokens.textSecondary;
    vars["--color-sidebar-divider"] = tokens.border;
    vars["--color-success-dark"] = tokens.successText;
    vars["--color-danger-dark"] = tokens.dangerText;
    vars["--color-negative-hex"] = tokens.dangerText;
  }
  if (presetId === "electric-spectrum") {
    vars["--spectrum-gradient"] = "linear-gradient(100deg, #0060FF 0%, #6830FF 50%, #CC00FF 100%)";
    vars["--spectrum-wordmark-source"] = "linear-gradient(90deg, #0060FF 0%, #824FF8 50%, #F5469B 100%)";
    vars["--spectrum-action-gradient"] = "linear-gradient(100deg, #0060FF 0%, #6830FF 50%, #C100F2 100%)";
    vars["--spectrum-action-gradient-hover"] = "linear-gradient(100deg, #0054E6 0%, #5C28F2 50%, #A600DE 100%)";
    vars["--spectrum-wordmark"] = "linear-gradient(90deg, #0060FF 0%, #824FF8 50%, #E40C75 100%)";
    vars["--spectrum-glow"] = "0 8px 18px rgba(104, 48, 255, 0.22)";
    vars["--color-electric-blue"] = "#0060FF";
    vars["--color-rich-violet"] = "#6830FF";
    vars["--color-wordmark-violet"] = "#824FF8";
    vars["--color-hot-magenta"] = "#CC00FF";
    vars["--color-bright-pink"] = "#F5469B";
    vars["--color-soft-lavender"] = "#E9E8FF";
    vars["--color-chart-tertiary"] = "#C044EE";
    vars["--color-sidebar-icon"] = tokens.sidebarMuted;
    vars["--color-sidebar-secondary"] = tokens.textSecondary;
    vars["--color-sidebar-divider"] = tokens.border;
    vars["--color-success-dark"] = tokens.successText;
    vars["--color-danger-dark"] = tokens.dangerText;
    vars["--color-negative-hex"] = tokens.dangerText;
  }
  return vars;
}

export const PRESET_CSS_VARIABLES: Record<ThemePresetId, Record<string, string>> = Object.fromEntries(
  THEME_PRESET_IDS.map((id) => [id, cssVariablesFor(id)])
) as Record<ThemePresetId, Record<string, string>>;

/** Latest profile response wins. A failed latest response reverts; older responses are ignored. */
export function resolveSaveResult(
  requestId: number,
  latestId: number,
  ok: boolean
): "commit" | "ignore" | "revert" {
  if (requestId !== latestId) return "ignore";
  return ok ? "commit" : "revert";
}

export function buildAppearanceBootScript(storageKey: string): string {
  const payload = JSON.stringify({
    key: storageKey,
    css: PRESET_CSS_VARIABLES,
    modes: Object.fromEntries(THEME_PRESET_IDS.map((id) => [id, THEME_PRESETS[id].mode])),
  });
  const fallback = JSON.stringify(DEFAULT_THEME_ID);
  return `(function(){try{var D=${payload};var theme=${fallback};var raw=localStorage.getItem(D.key);var stored=null;if(raw){stored=JSON.parse(raw);var t=stored&&typeof stored.theme==="string"?stored.theme:"";if(t==="dark")theme="midnight-pro";else if(t==="light")theme=${fallback};else if(t==="system"||D.css[t]||/^ct_[a-f0-9]{12}$/.test(t))theme=t;if(t==="dark"||t==="light"){try{stored.theme=theme;localStorage.setItem(D.key,JSON.stringify(stored));}catch(e){}}}var custom=stored&&stored.customCss&&stored.customCss[theme];if(custom&&custom.vars){var root=document.documentElement;var customDark=custom.mode==="dark";root.classList.toggle("dark",customDark);root.classList.toggle("light",!customDark);root.style.colorScheme=customDark?"dark":"light";root.dataset.theme=custom.base&&D.css[custom.base]?custom.base:${fallback};root.dataset.preference=theme;root.dataset.customTheme="1";var customVars=custom.vars;for(var key in customVars){if(Object.prototype.hasOwnProperty.call(customVars,key))root.style.setProperty(key,customVars[key]);}return;}var resolved=theme;if(theme==="system"){resolved=window.matchMedia("(prefers-color-scheme: dark)").matches?"midnight-pro":"classic";}if(!D.css[resolved])resolved=${fallback};var vars=D.css[resolved];var node=document.documentElement;var dark=D.modes[resolved]==="dark";node.classList.toggle("dark",dark);node.classList.toggle("light",!dark);node.style.colorScheme=dark?"dark":"light";node.dataset.theme=resolved;node.dataset.preference=theme;delete node.dataset.customTheme;for(var name in vars){if(Object.prototype.hasOwnProperty.call(vars,name))node.style.setProperty(name,vars[name]);}}catch(e){}})();`;
}
