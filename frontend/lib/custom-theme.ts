/**
 * Custom theme drafts, validation, contrast, and CSS variable builds.
 * Built-in presets stay in theme-registry.ts. This module only overlays a draft.
 */

import { CUSTOM_THEME_TOKENS, TOKEN_GROUPS, tokenById, type ThemeTokenDef, type TokenGroupId } from "@/lib/custom-theme-tokens";
import {
  contrastRatio,
  cssVariablesFor,
  hexToHslChannels,
  hslChannelsToHex,
  isCustomThemeId,
  isThemePresetId,
  relativeLuminance,
  THEME_PRESETS,
  type ThemeMode,
  type ThemePresetId,
} from "@/lib/theme-registry";

export { isCustomThemeId };

export const CUSTOM_THEME_SCHEMA_VERSION = 1;
export const CUSTOM_THEME_LIMIT = 12;
export const CUSTOM_THEME_NAME_MAX = 48;
export const CUSTOM_THEME_EXPORT_KIND = "tradefix-custom-theme";
export const COLOR_HISTORY_LIMIT = 50;

const GRADIENT_SOURCE_VARS = ["--aurora-gradient", "--spectrum-gradient", "--spectrum-action-gradient"];
const GRADIENT_WRITE_VARS = [
  "--aurora-gradient",
  "--aurora-gradient-hover",
  "--spectrum-gradient",
  "--spectrum-wordmark-source",
  "--spectrum-action-gradient",
  "--spectrum-action-gradient-hover",
  "--spectrum-wordmark",
];
const NAMED_STOP_VARS: [string, 0 | 1 | 2][] = [
  ["--color-electric-blue", 0],
  ["--color-rich-violet", 1],
  ["--color-wordmark-violet", 1],
  ["--color-hot-magenta", 2],
  ["--color-bright-pink", 2],
];

export type Rgba = { r: number; g: number; b: number; a: number };
export type ColorMap = Record<string, string>;

export type CustomThemeRecord = {
  id: string;
  name: string;
  base_theme_id: ThemePresetId;
  mode: ThemeMode;
  tokens: ColorMap;
  schema_version: number;
};

export type CustomThemesDocument = {
  revision: number;
  themes: CustomThemeRecord[];
};

export type CustomCssPack = {
  mode: ThemeMode;
  base: ThemePresetId;
  vars: Record<string, string>;
};

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d+)\s*)?\)$/i;
const HSL_CHANNELS = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;

export function parseCssColor(input: string): Rgba | null {
  const value = input.trim();
  const hex = HEX_COLOR.exec(value);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) raw = raw.split("").map((part) => part + part).join("");
    if (raw.length === 6) raw += "ff";
    const n = Number.parseInt(raw, 16);
    return { r: (n >> 24) & 255, g: (n >> 16) & 255, b: (n >> 8) & 255, a: Math.round(((n & 255) / 255) * 1000) / 1000 };
  }
  const rgb = RGB_COLOR.exec(value);
  if (!rgb) return null;
  const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (channels.some((channel) => channel > 255)) return null;
  const alpha = rgb[4] == null ? 1 : Number(rgb[4]);
  if (Number.isNaN(alpha) || alpha < 0 || alpha > 1) return null;
  return { r: channels[0], g: channels[1], b: channels[2], a: alpha };
}

export function formatColor(color: Rgba): string {
  const hex = [color.r, color.g, color.b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("");
  if (color.a >= 0.999) return `#${hex.toUpperCase()}`;
  const alpha = clampByte(Math.round(color.a * 255)).toString(16).padStart(2, "0");
  return `#${hex}${alpha}`.toUpperCase();
}

export function canonicalColor(input: string): string | null {
  const parsed = parseCssColor(input);
  return parsed ? formatColor(parsed) : null;
}

export function opaqueHex(input: string): string | null {
  const parsed = parseCssColor(input);
  return parsed ? formatColor({ ...parsed, a: 1 }) : null;
}

export function colorChannels(input: string): { rgb: Rgba; hsl: { h: number; s: number; l: number; a: number } } | null {
  const parsed = parseCssColor(input);
  if (!parsed) return null;
  const opaque = formatColor({ ...parsed, a: 1 });
  const match = hexToHslChannels(opaque).match(HSL_CHANNELS);
  if (!match) return null;
  return {
    rgb: parsed,
    hsl: { h: Math.round(Number(match[1])), s: Math.round(Number(match[2])), l: Math.round(Number(match[3])), a: parsed.a },
  };
}

export function rgbToColor(r: number, g: number, b: number, a = 1): string | null {
  if ([r, g, b].some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) return null;
  if (a < 0 || a > 1) return null;
  return formatColor({ r, g, b, a });
}

export function hslToColor(h: number, s: number, l: number, a = 1): string | null {
  if (![h, s, l].every(Number.isFinite) || h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) return null;
  if (a < 0 || a > 1) return null;
  const hex = hslChannelsToHex(`${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`);
  const parsed = parseCssColor(hex);
  return parsed ? formatColor({ ...parsed, a }) : null;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha),
    g: Math.round((foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha),
    b: Math.round((foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha),
    a: alpha,
  };
}

export function measureContrast(foreground: string, background: string, underlay?: string): number | null {
  const fg = parseCssColor(foreground);
  const bg = parseCssColor(background);
  if (!fg || !bg) return null;
  const base = underlay ? parseCssColor(underlay) : null;
  const paperSource = base && bg.a < 0.999 ? composite(bg, base) : bg;
  const paper = paperSource.a >= 0.999 ? paperSource : composite(paperSource, { r: 255, g: 255, b: 255, a: 1 });
  const ink = fg.a >= 0.999 ? fg : composite(fg, paper);
  try {
    return contrastRatio(formatColor({ ...ink, a: 1 }), formatColor({ ...paper, a: 1 }));
  } catch {
    return null;
  }
}

export function suggestAccessibleColor(foreground: string, background: string, minimum: number): string | null {
  const current = measureContrast(foreground, background);
  if (current != null && current >= minimum - 0.01) return null;
  const parsed = parseCssColor(foreground);
  const bg = parseCssColor(background);
  if (!parsed || !bg) return null;
  const paper = formatColor({ ...(bg.a >= 0.999 ? bg : composite(bg, { r: 255, g: 255, b: 255, a: 1 })), a: 1 });
  const opaque = formatColor({ ...parsed, a: 1 });
  const match = hexToHslChannels(opaque).match(HSL_CHANNELS);
  if (!match) return null;
  const hue = Math.round(Number(match[1]));
  const saturation = Math.round(Number(match[2]));
  const lightness = Math.round(Number(match[3]));
  let best: { color: string; delta: number } | null = null;
  for (let light = 0; light <= 100; light += 1) {
    const color = hslChannelsToHex(`${hue} ${saturation}% ${light}%`);
    const ratio = contrastRatio(color, paper);
    if (ratio + 0.01 < minimum) continue;
    const delta = Math.abs(light - lightness);
    if (!best || delta < best.delta) best = { color, delta };
  }
  if (best) return best.color;
  for (const color of ["#000000", "#FFFFFF"]) {
    if (contrastRatio(color, paper) >= minimum) return color;
  }
  return null;
}

const seedCache = new Map<ThemePresetId, ColorMap>();

export function seedColors(baseId: ThemePresetId): ColorMap {
  const cached = seedCache.get(baseId);
  if (cached) return { ...cached };
  const css = cssVariablesFor(baseId);
  const colors: ColorMap = {};
  for (const definition of CUSTOM_THEME_TOKENS) {
    colors[definition.id] = seedToken(css, definition);
  }
  seedCache.set(baseId, colors);
  return { ...colors };
}

function seedToken(css: Record<string, string>, definition: ThemeTokenDef): string {
  if (definition.seed.from === "gradient") {
    return gradientStops(css)[definition.seed.index];
  }
  const raw = css[definition.seed.css];
  if (raw && definition.seed.from === "color") {
    const direct = canonicalColor(raw);
    if (direct) return direct;
  }
  if (raw && definition.seed.from === "channel") {
    try {
      return hslChannelsToHex(raw);
    } catch {
      const direct = canonicalColor(raw);
      if (direct) return direct;
    }
  }
  if (raw && definition.seed.from === "focus") {
    const found = raw.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\([^)]+\)/);
    if (found) {
      const color = canonicalColor(found[0]);
      if (color) return color;
    }
  }
  const fallback = canonicalColor(css["--color-primary"] ?? "") ?? "#5B4696";
  return fallback;
}

function gradientStops(css: Record<string, string>): [string, string, string] {
  for (const key of GRADIENT_SOURCE_VARS) {
    const stops = extractHexes(css[key] ?? "");
    if (stops.length >= 3) return [stops[0], stops[1], stops[2]];
    if (stops.length === 2) return [stops[0], stops[1], stops[1]];
    if (stops.length === 1) return [stops[0], stops[0], stops[0]];
  }
  const primary = canonicalColor(css["--color-primary"] ?? "") ?? "#5B4696";
  const hover = canonicalColor(css["--color-primary-hover"] ?? "") ?? primary;
  const active = canonicalColor(css["--color-primary-active"] ?? "") ?? hover;
  return [primary, hover, active];
}

function extractHexes(value: string): string[] {
  return (value.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [])
    .map((hex) => canonicalColor(hex))
    .filter((hex): hex is string => Boolean(hex));
}

export function normalizeTokens(baseId: ThemePresetId, partial: ColorMap | null | undefined): ColorMap {
  const next = seedColors(baseId);
  if (!partial) return next;
  for (const definition of CUSTOM_THEME_TOKENS) {
    const value = partial[definition.id];
    if (typeof value !== "string") continue;
    const color = canonicalColor(value);
    if (color) next[definition.id] = color;
  }
  return next;
}

export function cssForCustom(baseId: ThemePresetId, partial: ColorMap): Record<string, string> {
  const base = { ...cssVariablesFor(baseId) };
  const seed = seedColors(baseId);
  const colors = normalizeTokens(baseId, partial);
  const vars = { ...base };
  for (const definition of CUSTOM_THEME_TOKENS) {
    if (definition.seed.from === "gradient") continue;
    const next = colors[definition.id];
    const previous = seed[definition.id];
    const changed = next !== previous;
    for (const name of definition.colorVars ?? []) {
      if (!changed && name in base) continue;
      vars[name] = next;
    }
    if (!changed) continue;
    const opaque = opaqueHex(next);
    if (opaque && definition.channels?.length) {
      const channels = hexToHslChannels(opaque);
      for (const name of definition.channels) vars[name] = channels;
    }
    if (definition.focusRing) vars["--focus-ring"] = `0 0 0 2px ${next}`;
  }
  applyGradientEdits(vars, base, seed, colors);
  return vars;
}

function applyGradientEdits(vars: Record<string, string>, base: Record<string, string>, seed: ColorMap, colors: ColorMap) {
  const next: [string, string, string] = [colors.gradientStart, colors.gradientMiddle, colors.gradientEnd];
  const previous: [string, string, string] = [seed.gradientStart, seed.gradientMiddle, seed.gradientEnd];
  if (next.every((color, index) => color === previous[index])) return;
  for (const name of GRADIENT_WRITE_VARS) {
    if (!base[name]) continue;
    let index = 0;
    vars[name] = base[name].replace(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (hex) => {
      const replacement = next[Math.min(index, next.length - 1)] ?? hex;
      index += 1;
      return replacement;
    });
  }
  for (const [name, index] of NAMED_STOP_VARS) {
    if (!base[name]) continue;
    const current = canonicalColor(base[name]);
    if (current && current === previous[index]) vars[name] = next[index];
  }
  vars["--brand-gradient"] = `linear-gradient(135deg, ${next[0]} 0%, ${next[1]} 55%, ${next[2]} 100%)`;
}

export function modeForColors(baseId: ThemePresetId, colors: ColorMap): ThemeMode {
  const background = colors.background ?? seedColors(baseId).background;
  const opaque = opaqueHex(background);
  if (!opaque) return THEME_PRESETS[baseId].mode;
  try {
    return relativeLuminance(opaque) < 0.4 ? "dark" : "light";
  } catch {
    return THEME_PRESETS[baseId].mode;
  }
}

export function changedTokenIds(baseId: ThemePresetId, colors: ColorMap): string[] {
  const seed = seedColors(baseId);
  return CUSTOM_THEME_TOKENS.filter((definition) => colors[definition.id] && colors[definition.id] !== seed[definition.id]).map(
    (definition) => definition.id
  );
}

export function createCustomThemeId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `ct_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function buildCustomTheme(input: {
  id?: string;
  name: string;
  baseThemeId: ThemePresetId;
  tokens: ColorMap;
}): CustomThemeRecord {
  const tokens = normalizeTokens(input.baseThemeId, input.tokens);
  return {
    id: input.id && isCustomThemeId(input.id) ? input.id : createCustomThemeId(),
    name: input.name.trim(),
    base_theme_id: input.baseThemeId,
    mode: modeForColors(input.baseThemeId, tokens),
    tokens,
    schema_version: CUSTOM_THEME_SCHEMA_VERSION,
  };
}

export function validateThemeName(name: string, themes: Pick<CustomThemeRecord, "id" | "name">[], ignoreId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a theme name.";
  if (trimmed.length > CUSTOM_THEME_NAME_MAX) return `Use ${CUSTOM_THEME_NAME_MAX} characters or fewer.`;
  const clash = themes.some((theme) => theme.id !== ignoreId && theme.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (clash) return "You already have a custom theme with this name.";
  return null;
}

export function duplicateThemeName(name: string, themes: Pick<CustomThemeRecord, "name">[]): string {
  const base = `Copy of ${name}`.slice(0, CUSTOM_THEME_NAME_MAX);
  const taken = new Set(themes.map((theme) => theme.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let index = 2; index < 100; index += 1) {
    const suffix = ` ${index}`;
    const next = `${base.slice(0, CUSTOM_THEME_NAME_MAX - suffix.length)}${suffix}`;
    if (!taken.has(next.toLowerCase())) return next;
  }
  return base;
}

export function parseCustomThemesDocument(value: unknown): CustomThemesDocument {
  if (!value || typeof value !== "object") return { revision: 0, themes: [] };
  const record = value as { revision?: unknown; themes?: unknown };
  const revision = typeof record.revision === "number" && Number.isFinite(record.revision) && record.revision >= 0
    ? Math.floor(record.revision)
    : 0;
  if (!Array.isArray(record.themes)) return { revision, themes: [] };
  const themes = record.themes.map(parseThemeRecord).filter((theme): theme is CustomThemeRecord => Boolean(theme));
  return { revision, themes: themes.slice(0, CUSTOM_THEME_LIMIT) };
}

function parseThemeRecord(value: unknown): CustomThemeRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<CustomThemeRecord>;
  if (!isCustomThemeId(record.id) || typeof record.name !== "string" || !record.name.trim()) return null;
  if (!isThemePresetId(record.base_theme_id)) return null;
  if (!record.tokens || typeof record.tokens !== "object") return null;
  const tokens = normalizeTokens(record.base_theme_id, record.tokens as ColorMap);
  return {
    id: record.id,
    name: record.name.trim().slice(0, CUSTOM_THEME_NAME_MAX),
    base_theme_id: record.base_theme_id,
    mode: record.mode === "dark" || record.mode === "light" ? record.mode : modeForColors(record.base_theme_id, tokens),
    tokens,
    schema_version: CUSTOM_THEME_SCHEMA_VERSION,
  };
}

export function cssCacheFor(themes: CustomThemeRecord[]): Record<string, CustomCssPack> {
  const cache: Record<string, CustomCssPack> = {};
  for (const theme of themes) {
    cache[theme.id] = {
      mode: theme.mode,
      base: theme.base_theme_id,
      vars: cssForCustom(theme.base_theme_id, theme.tokens),
    };
  }
  return cache;
}

export type EditHistory = {
  past: ColorMap[];
  present: ColorMap;
  future: ColorMap[];
};

export function historyInit(colors: ColorMap): EditHistory {
  return { past: [], present: colors, future: [] };
}

export function historyPush(history: EditHistory, next: ColorMap): EditHistory {
  if (sameColors(history.present, next)) return history;
  return {
    past: [...history.past, history.present].slice(-COLOR_HISTORY_LIMIT),
    present: next,
    future: [],
  };
}

export function historyUndo(history: EditHistory): EditHistory {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function historyRedo(history: EditHistory): EditHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-COLOR_HISTORY_LIMIT),
    present: next,
    future: history.future.slice(1),
  };
}

export function sameColors(left: ColorMap, right: ColorMap): boolean {
  return CUSTOM_THEME_TOKENS.every((definition) => left[definition.id] === right[definition.id]);
}

export function resetToken(colors: ColorMap, baseId: ThemePresetId, tokenId: string): ColorMap {
  const definition = tokenById(tokenId);
  if (!definition) return colors;
  return { ...colors, [tokenId]: seedColors(baseId)[tokenId] };
}

export function resetGroup(colors: ColorMap, baseId: ThemePresetId, group: TokenGroupId): ColorMap {
  const seed = seedColors(baseId);
  const next = { ...colors };
  for (const definition of CUSTOM_THEME_TOKENS) {
    if (definition.group === group) next[definition.id] = seed[definition.id];
  }
  return next;
}

export type ContrastPair = {
  id: string;
  label: string;
  foreground: string;
  background: string;
  underlay?: string;
  minimum: number;
};

export const CONTRAST_PAIRS: ContrastPair[] = [
  { id: "text-page", label: "Primary text on the page", foreground: "textPrimary", background: "background", minimum: 4.5 },
  { id: "text-card", label: "Primary text on cards", foreground: "textPrimary", background: "surface", minimum: 4.5 },
  { id: "secondary-card", label: "Secondary text on cards", foreground: "textSecondary", background: "surface", minimum: 4.5 },
  { id: "muted-card", label: "Muted text on cards", foreground: "textMuted", background: "surface", minimum: 4.5 },
  { id: "primary-button", label: "Primary button text", foreground: "primaryForeground", background: "primary", minimum: 4.5 },
  { id: "primary-hover", label: "Primary button hover", foreground: "primaryForeground", background: "primaryHover", minimum: 4.5 },
  { id: "primary-active", label: "Primary button pressed", foreground: "primaryForeground", background: "primaryActive", minimum: 4.5 },
  { id: "input-text", label: "Input text", foreground: "inputText", background: "inputBg", minimum: 4.5 },
  { id: "placeholder", label: "Placeholder text", foreground: "placeholder", background: "inputBg", minimum: 4.5 },
  { id: "sidebar", label: "Sidebar text", foreground: "sidebarForeground", background: "sidebar", minimum: 4.5 },
  { id: "sidebar-muted", label: "Sidebar muted text", foreground: "sidebarMuted", background: "sidebar", minimum: 4.5 },
  { id: "sidebar-active", label: "Selected navigation", foreground: "sidebarActiveText", background: "sidebarActive", underlay: "sidebar", minimum: 4.5 },
  { id: "tooltip", label: "Tooltip text", foreground: "tooltipTitle", background: "chartTooltipBg", minimum: 4.5 },
  { id: "success", label: "Success text", foreground: "successText", background: "successSubtle", minimum: 4.5 },
  { id: "danger", label: "Danger text", foreground: "dangerText", background: "dangerSubtle", minimum: 4.5 },
  { id: "table", label: "Table text", foreground: "textPrimary", background: "surface", minimum: 4.5 },
  { id: "table-selected", label: "Selected row text", foreground: "textPrimary", background: "tableSelected", minimum: 4.5 },
  { id: "focus", label: "Focus ring on the page", foreground: "focusRing", background: "background", minimum: 3 },
];

export type ContrastResult = {
  pair: ContrastPair;
  ratio: number | null;
  pass: boolean;
  suggestion: string | null;
};

export function evaluateContrast(colors: ColorMap): ContrastResult[] {
  return CONTRAST_PAIRS.map((pair) => {
    const ratio = measureContrast(
      colors[pair.foreground] ?? "",
      colors[pair.background] ?? "",
      pair.underlay ? colors[pair.underlay] : undefined
    );
    const pass = ratio != null && ratio + 0.01 >= pair.minimum;
    return {
      pair,
      ratio,
      pass,
      suggestion: pass ? null : suggestAccessibleColor(colors[pair.foreground] ?? "", colors[pair.background] ?? "", pair.minimum),
    };
  });
}

export function serializeThemeExport(theme: CustomThemeRecord) {
  return {
    kind: CUSTOM_THEME_EXPORT_KIND,
    schemaVersion: CUSTOM_THEME_SCHEMA_VERSION,
    name: theme.name,
    baseThemeId: theme.base_theme_id,
    mode: theme.mode,
    tokens: theme.tokens,
  };
}

export function parseImportedTheme(
  raw: unknown,
  fallbackBase: ThemePresetId
): { ok: true; name: string; baseThemeId: ThemePresetId; tokens: ColorMap } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "This file is not a TradeFix theme." };
  }
  const record = raw as Record<string, unknown>;
  if (record.kind !== CUSTOM_THEME_EXPORT_KIND) {
    return { ok: false, error: "This file is not a TradeFix custom theme export." };
  }
  if (record.schemaVersion !== CUSTOM_THEME_SCHEMA_VERSION) {
    return { ok: false, error: "This theme file uses a schema this version of TradeFix cannot import." };
  }
  const baseThemeId = isThemePresetId(record.baseThemeId) ? record.baseThemeId : fallbackBase;
  if (typeof record.name !== "string" || !record.name.trim()) {
    return { ok: false, error: "The theme file is missing a name." };
  }
  if (!record.tokens || typeof record.tokens !== "object" || Array.isArray(record.tokens)) {
    return { ok: false, error: "The theme file is missing its colors." };
  }
  const incoming = record.tokens as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    if (!tokenById(key)) continue;
    if (typeof value !== "string" || !canonicalColor(value)) {
      return { ok: false, error: `“${key}” is not a valid color.` };
    }
  }
  return {
    ok: true,
    name: record.name.trim().slice(0, CUSTOM_THEME_NAME_MAX),
    baseThemeId,
    tokens: normalizeTokens(baseThemeId, incoming as ColorMap),
  };
}

export function downloadThemeFile(theme: CustomThemeRecord) {
  const blob = new Blob([JSON.stringify(serializeThemeExport(theme), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = theme.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-theme";
  link.href = url;
  link.download = `${slug}.tradefix-theme.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function managedCustomVariables(): string[] {
  const names = new Set<string>(["--brand-gradient"]);
  for (const definition of CUSTOM_THEME_TOKENS) {
    for (const name of definition.colorVars ?? []) names.add(name);
    for (const name of definition.channels ?? []) names.add(name);
    if (definition.focusRing) names.add("--focus-ring");
  }
  for (const name of GRADIENT_WRITE_VARS) names.add(name);
  return [...names];
}

export function groupLabel(group: TokenGroupId): string {
  return TOKEN_GROUPS.find((item) => item.id === group)?.label ?? group;
}

export function searchTokens(query: string): ThemeTokenDef[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return CUSTOM_THEME_TOKENS;
  return CUSTOM_THEME_TOKENS.filter((definition) => {
    const group = groupLabel(definition.group).toLowerCase();
    return (
      definition.id.toLowerCase().includes(needle) ||
      definition.label.toLowerCase().includes(needle) ||
      definition.description.toLowerCase().includes(needle) ||
      group.includes(needle)
    );
  });
}
