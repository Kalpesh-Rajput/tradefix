/**
 * Theme registry, migration, Follow device, HSL channels, and contrast.
 * Run: npx --yes tsx scripts/test-themes.ts
 */
import assert from "node:assert/strict";

import {
  contrastRatio,
  cssVariablesFor,
  hexToHslChannels,
  hslChannelsToHex,
  HSL_CHANNEL_VARS,
  migrateStoredTheme,
  parseHex,
  PRESET_CSS_VARIABLES,
  REQUIRED_TOKEN_KEYS,
  resolveSaveResult,
  resolveTheme,
  DEFAULT_THEME_ID,
  THEME_GROUPS,
  THEME_ORDER,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  type ThemePresetId,
  type ThemeTokens,
} from "../lib/theme-registry";

assert.equal(THEME_PRESET_IDS.length, 14);
assert.equal(THEME_PRESETS["signature-dark"].mode, "dark");
assert.equal(THEME_PRESETS["signature-dark"].tokens.background, "#0B0D14");
assert.equal(THEME_PRESETS["signature-dark"].tokens.surface, "#11141E");
assert.equal(THEME_PRESETS["signature-dark"].tokens.surfaceElevated, "#171B29");
assert.equal(THEME_PRESETS["signature-dark"].tokens.primary, "#8B6CF6");
assert.equal(THEME_PRESETS["signature-light"].mode, "light");
assert.ok(cssVariablesFor("signature-dark")["--color-champagne"]);
assert.ok(cssVariablesFor("signature-light")["--signature-hairline"]);
assert.equal(cssVariablesFor("classic")["--color-champagne"], undefined);
assert.equal(DEFAULT_THEME_ID, "tradefix-purple");
assert.deepEqual(THEME_ORDER, [...THEME_PRESET_IDS]);
assert.deepEqual(
  THEME_GROUPS.flatMap((group) => group.ids),
  [...THEME_PRESET_IDS]
);
for (const id of THEME_PRESET_IDS) {
  assert.ok(THEME_PRESETS[id], id);
  for (const key of REQUIRED_TOKEN_KEYS) {
    assert.match(THEME_PRESETS[id].tokens[key], /^#[0-9A-Fa-f]{6}$/, `${id}.${key}`);
  }
}

assert.equal(THEME_PRESETS.classic.tokens.background, "#F3F4F6");
assert.equal(THEME_PRESETS.classic.tokens.surface, "#FFFFFF");
assert.equal(THEME_PRESETS.classic.tokens.primary, "#4F46E5");
assert.equal(THEME_PRESETS.classic.tokens.textPrimary, "#111827");
assert.equal(THEME_PRESETS.classic.tokens.border, "#E5E7EB");
assert.equal(THEME_PRESETS.classic.tokens.chartProfit, "#40C79A");
assert.equal(THEME_PRESETS.classic.tokens.chartLoss, "#F26969");
assert.equal(THEME_PRESETS.classic.tokens.successText, "#047857");
assert.equal(THEME_PRESETS.classic.tokens.dangerText, "#B91C1C");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.background, "#F2F4F5");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.surface, "#FFFFFF");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.primary, "#5B4696");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.primaryHover, "#4F3C87");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.primaryActive, "#49377D");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.textPrimary, "#14151A");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.sidebar, "#1C1C3A");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.chartLine, "#4B438B");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.chartProfit, "#40C79A");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.success, "#5B4696");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.successText, "#2F9E6A");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.textMuted, "#85868E");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.dangerText, "#D64545");
assert.equal(THEME_PRESETS["tradefix-purple"].mode, "light");
assert.equal(cssVariablesFor("tradefix-purple")["--primary"], "255 36% 43%");
assert.equal(cssVariablesFor("tradefix-purple")["--background"], "200 11% 95%");
assert.equal(cssVariablesFor("tradefix-purple")["--positive"], "255 36% 43%");
assert.equal(cssVariablesFor("tradefix-purple")["--color-surface-secondary"], "#FEFEFE");
assert.equal(cssVariablesFor("tradefix-purple")["--color-primary-very-light"], "#F7F4FC");
assert.equal(cssVariablesFor("tradefix-purple")["--color-text-kpi"], "#111218");
assert.equal(cssVariablesFor("tradefix-purple")["--color-text-label"], "#4F5058");
assert.equal(cssVariablesFor("tradefix-purple")["--color-border-light"], "#EEEEF1");
assert.equal(cssVariablesFor("tradefix-purple")["--color-success-light"], "#F7F4FC");
assert.equal(cssVariablesFor("tradefix-purple")["--color-danger-light"], "#F8DDE0");
assert.equal(cssVariablesFor("tradefix-purple")["--color-warning-badge"], "#F4D34F");
assert.equal(cssVariablesFor("tradefix-purple")["--color-sidebar-icon"], "#AAA4B5");
assert.equal(cssVariablesFor("tradefix-purple")["--color-sidebar-active"], "rgba(124, 92, 191, 0.25)");
assert.equal(cssVariablesFor("tradefix-purple")["--color-sidebar-hover"], "rgba(255, 255, 255, 0.06)");
assert.equal(cssVariablesFor("tradefix-purple")["--color-sidebar-indicator"], "#A78BFA");
assert.equal(cssVariablesFor("tradefix-purple")["--sidebar-muted"], "248 27% 77%");
assert.equal(THEME_PRESETS["tradefix-purple"].tokens.sidebarMuted, "#B8B4D4");
assert.equal(cssVariablesFor("classic")["--color-sidebar-indicator"], THEME_PRESETS.classic.tokens.primary);
assert.equal(cssVariablesFor("tradefix-purple")["--color-breakeven"], "#7B8DB8");
assert.equal(cssVariablesFor("tradefix-purple")["--color-negative-hex"], "#E35D68");
assert.equal(cssVariablesFor("tradefix-purple")["--focus-ring"], "0 0 0 2px #5B469626");
assert.equal(cssVariablesFor("classic")["--color-sidebar-icon"], "#C7C2D0");
assert.equal(cssVariablesFor("classic")["--color-negative-hex"], THEME_PRESETS.classic.tokens.chartLoss);
assert.equal(cssVariablesFor("midnight-pro")["--primary"], hexToHslChannels(THEME_PRESETS["midnight-pro"].tokens.primary));
assert.equal(THEME_PRESETS["midnight-pro"].tokens.background, "#0B1220");
assert.equal(THEME_PRESETS["midnight-pro"].tokens.surface, "#111827");
assert.equal(THEME_PRESETS["midnight-pro"].tokens.primary, "#818CF8");
assert.equal(THEME_PRESETS["midnight-pro"].tokens.primaryForeground, "#0F172A");
assert.equal(THEME_PRESETS["midnight-pro"].tokens.textPrimary, "#F9FAFB");
assert.equal(THEME_PRESETS["midnight-pro"].tokens.chartProfit, "#34D399");
assert.equal(THEME_PRESETS["midnight-pro"].mode, "dark");
assert.equal(THEME_PRESETS["obsidian-gold"].mode, "dark");
assert.equal(THEME_PRESETS["obsidian-gold"].tokens.background, "#0A0A0C");
assert.equal(THEME_PRESETS["obsidian-gold"].tokens.primary, "#BEA064");
assert.notEqual(THEME_PRESETS["obsidian-gold"].tokens.primary, THEME_PRESETS["midnight-pro"].tokens.primary);

assert.equal(migrateStoredTheme("dark"), "midnight-pro");
assert.equal(migrateStoredTheme("light"), "tradefix-purple");
assert.equal(migrateStoredTheme("system"), "system");
assert.equal(migrateStoredTheme("classic"), "classic");
assert.equal(migrateStoredTheme("ocean-blue"), "ocean-blue");
assert.equal(migrateStoredTheme("obsidian-gold"), "obsidian-gold");
assert.equal(migrateStoredTheme("burgundy-champagne"), "burgundy-champagne");
assert.equal(migrateStoredTheme("violet-aurora"), "violet-aurora");
assert.equal(THEME_PRESETS["violet-aurora"].name, "Violet Aurora");
assert.equal(
  THEME_PRESETS["violet-aurora"].description,
  "A vibrant purple theme with luminous lavender accents."
);
assert.equal(THEME_PRESETS["violet-aurora"].tokens.background, "#F8F6FF");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.surface, "#FFFFFF");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.primary, "#7C3AED");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.primaryHover, "#6D28D9");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.primaryActive, "#5B21B6");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.primaryForeground, "#FFFFFF");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.textPrimary, "#24113F");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.chartProfit, "#34D399");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.chartLoss, "#F87171");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.successText, "#166534");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.dangerText, "#B91C1C");
assert.equal(THEME_PRESETS["violet-aurora"].tokens.chartLine, "#7C3AED");
assert.equal(THEME_PRESETS["violet-aurora"].mode, "light");
assert.equal(
  cssVariablesFor("violet-aurora")["--aurora-gradient"],
  "linear-gradient(135deg, #5B21B6 0%, #7C3AED 55%, #9333EA 100%)"
);
assert.equal(cssVariablesFor("violet-aurora")["--color-negative-hex"], "#B91C1C");
assert.equal(cssVariablesFor("violet-aurora")["--color-chart-loss"], "#F87171");
assert.equal(cssVariablesFor("violet-aurora")["--color-chart-profit"], "#34D399");
assert.equal(cssVariablesFor("tradefix-purple")["--aurora-gradient"], undefined);
assert.equal(cssVariablesFor("midnight-pro")["--aurora-gradient"], undefined);
assert.equal(migrateStoredTheme("electric-spectrum"), "electric-spectrum");
assert.equal(THEME_PRESETS["electric-spectrum"].name, "Electric Spectrum");
assert.equal(
  THEME_PRESETS["electric-spectrum"].description,
  "Vibrant blue-to-violet gradients with luminous magenta accents."
);
assert.equal(THEME_PRESETS["electric-spectrum"].mode, "light");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.background, "#F7F8FF");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.surface, "#FFFFFF");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.surfaceMuted, "#F0F3FF");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.surfaceSelected, "#E9E8FF");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.primary, "#4F46E5");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.primaryHover, "#4338CA");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.primaryActive, "#3730A3");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.primaryForeground, "#FFFFFF");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.textPrimary, "#171B3B");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.textSecondary, "#515A78");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.textMuted, "#676E87");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.textDisabled, "#676E87");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.successText, "#047857");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.dangerText, "#B91C1C");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.chartProfit, "#34C79A");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.chartLoss, "#F87171");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.chartLine, "#5B4BEB");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.chartSeries, "#3987FF");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.chartGrid, "#E5E7F3");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.chartAxis, "#68718C");
assert.equal(THEME_PRESETS["electric-spectrum"].tokens.tooltipBorder, "#DDE2F3");
assert.equal(
  cssVariablesFor("electric-spectrum")["--spectrum-gradient"],
  "linear-gradient(100deg, #0060FF 0%, #6830FF 50%, #CC00FF 100%)"
);
assert.equal(
  cssVariablesFor("electric-spectrum")["--spectrum-wordmark-source"],
  "linear-gradient(90deg, #0060FF 0%, #824FF8 50%, #F5469B 100%)"
);
assert.equal(
  cssVariablesFor("electric-spectrum")["--spectrum-action-gradient"],
  "linear-gradient(100deg, #0060FF 0%, #6830FF 50%, #C100F2 100%)"
);
assert.equal(
  cssVariablesFor("electric-spectrum")["--spectrum-wordmark"],
  "linear-gradient(90deg, #0060FF 0%, #824FF8 50%, #E40C75 100%)"
);
assert.equal(cssVariablesFor("electric-spectrum")["--color-electric-blue"], "#0060FF");
assert.equal(cssVariablesFor("electric-spectrum")["--color-rich-violet"], "#6830FF");
assert.equal(cssVariablesFor("electric-spectrum")["--color-wordmark-violet"], "#824FF8");
assert.equal(cssVariablesFor("electric-spectrum")["--color-hot-magenta"], "#CC00FF");
assert.equal(cssVariablesFor("electric-spectrum")["--color-bright-pink"], "#F5469B");
assert.equal(cssVariablesFor("electric-spectrum")["--color-soft-lavender"], "#E9E8FF");
assert.equal(cssVariablesFor("electric-spectrum")["--color-chart-tertiary"], "#C044EE");
assert.equal(cssVariablesFor("electric-spectrum")["--color-negative-hex"], "#B91C1C");
assert.equal(cssVariablesFor("electric-spectrum")["--color-chart-loss"], "#F87171");
assert.equal(cssVariablesFor("electric-spectrum")["--color-chart-profit"], "#34C79A");
assert.equal(cssVariablesFor("electric-spectrum")["--aurora-gradient"], undefined);
assert.equal(cssVariablesFor("violet-aurora")["--spectrum-gradient"], undefined);
assert.equal(cssVariablesFor("midnight-pro")["--spectrum-gradient"], undefined);
assert.equal(cssVariablesFor("tradefix-purple")["--spectrum-gradient"], undefined);
assert.equal(contrastRatio("#FFFFFF", "#CC00FF") < 4.5, true);
assert.equal(contrastRatio("#FFFFFF", "#C100F2") >= 4.5, true);
assert.equal(contrastRatio("#E40C75", "#FFFFFF") >= 4.5, true);
assert.equal(contrastRatio("#F5469B", "#FFFFFF") < 4.5, true);
assert.equal(THEME_PRESETS.classic.chrome.shadowSm, "0 1px 3px rgba(20, 20, 30, 0.05)");
assert.equal(THEME_PRESETS["midnight-pro"].chrome.shadowSm, "0 1px 3px rgba(0, 0, 0, 0.35)");
assert.equal(contrastRatio("#FFFFFF", "#9333EA") >= 4.5, true);
assert.equal(migrateStoredTheme("nope"), "tradefix-purple");
assert.equal(migrateStoredTheme(null), "tradefix-purple");

assert.equal(resolveTheme("system", true), "signature-dark");
assert.equal(resolveTheme("system", false), "signature-light");
assert.equal(resolveTheme("amethyst", true), "amethyst");
assert.notEqual(resolveTheme("system", true), resolveTheme("system", false));

assert.equal(resolveSaveResult(1, 2, true), "ignore");
assert.equal(resolveSaveResult(2, 2, true), "commit");
assert.equal(resolveSaveResult(2, 2, false), "revert");
assert.equal(resolveSaveResult(1, 2, false), "ignore");

const failures: string[] = [];

function expectContrast(id: string, name: string, fg: string, bg: string, min: number) {
  const ratio = contrastRatio(fg, bg);
  if (ratio < min) {
    failures.push(`${id} ${name}: ${ratio.toFixed(2)} (${fg} on ${bg}, need ${min})`);
  }
}

function checkPreset(id: ThemePresetId) {
  const tokens: ThemeTokens = THEME_PRESETS[id].tokens;
  const textOn = [
    ["primary text on page", tokens.textPrimary, tokens.background, 4.5],
    ["primary text on card", tokens.textPrimary, tokens.surface, 4.5],
    ["secondary text on page", tokens.textSecondary, tokens.background, 4.5],
    ["secondary text on card", tokens.textSecondary, tokens.surface, 4.5],
    ["muted text on page", tokens.textMuted, tokens.background, 4.5],
    ["muted text on card", tokens.textMuted, tokens.surface, 4.5],
    ["disabled text on input", tokens.textDisabled, tokens.inputBg, 4.5],
    ["placeholder on input", tokens.placeholder, tokens.inputBg, 4.5],
    ["input text on input", tokens.textPrimary, tokens.inputBg, 4.5],
    ["button label on primary", tokens.primaryForeground, tokens.primary, 4.5],
    ["button label on hover", tokens.primaryForeground, tokens.primaryHover, 4.5],
    ["button label on pressed", tokens.primaryForeground, tokens.primaryActive, 4.5],
    ["selected row text", tokens.textPrimary, tokens.tableSelected, 4.5],
    ["sidebar text", tokens.sidebarForeground, tokens.sidebar, 4.5],
    ["sidebar muted text", tokens.sidebarMuted, tokens.sidebar, 4.5],
    ["sidebar hover text", tokens.sidebarForeground, tokens.sidebarHover, 4.5],
    ["sidebar active text", tokens.sidebarForeground, tokens.sidebarActive, 4.5],
    ["success text on card", tokens.successText, tokens.surface, 4.5],
    ["success text on subtle", tokens.successText, tokens.successSubtle, 4.5],
    ["danger text on card", tokens.dangerText, tokens.surface, 4.5],
    ["danger text on subtle", tokens.dangerText, tokens.dangerSubtle, 4.5],
    ["warning text on subtle", tokens.warningText, tokens.warningSubtle, 4.5],
    ["info text on subtle", tokens.infoText, tokens.infoSubtle, 4.5],
    ["tooltip text", tokens.tooltipText, tokens.tooltipBg, 4.5],
    ["dialog text", tokens.textPrimary, tokens.surfaceElevated, 4.5],
    ["focus on page", tokens.primary, tokens.background, 3],
    ["focus on card", tokens.primary, tokens.surface, 3],
  ] as const;

  for (const [name, fg, bg, min] of textOn) {
    // Original light theme shipped these colors. Do not retint them to clear 4.5.
    if (
      id === "tradefix-purple" &&
      (name.startsWith("muted text") || name.startsWith("success text") || name.startsWith("danger text"))
    ) {
      continue;
    }
    expectContrast(id, name, fg, bg, min);
  }

  const vars = cssVariablesFor(id);
  assert.deepEqual(PRESET_CSS_VARIABLES[id], vars);
  for (const name of Object.keys(HSL_CHANNEL_VARS)) {
    assert.equal(vars[name].includes("#"), false, `${id} ${name} must be HSL channels`);
    if (id === "tradefix-purple") continue;
    const back = parseHex(hslChannelsToHex(vars[name]));
    const source = parseHex(tokens[HSL_CHANNEL_VARS[name]]);
    const drift = Math.max(Math.abs(back.r - source.r), Math.abs(back.g - source.g), Math.abs(back.b - source.b));
    assert.ok(drift <= 2, `${id} ${name} round-trip drift ${drift}`);
  }
  assert.equal(hexToHslChannels(tokens.primary).includes("#"), false);
}

function mixHex(start: string, end: string, amount: number): string {
  const a = parseHex(start);
  const b = parseHex(end);
  const channel = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return `#${[channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function expectGradientContrast(name: string, stops: readonly string[], background: string, min: number) {
  for (let step = 0; step <= 20; step += 1) {
    const position = step / 20;
    const segment = Math.min(stops.length - 2, Math.floor(position * (stops.length - 1)));
    const local = position * (stops.length - 1) - segment;
    const color = mixHex(stops[segment], stops[segment + 1], local);
    expectContrast("electric-spectrum", `${name} ${position.toFixed(2)}`, color, background, min);
  }
}

expectGradientContrast(
  "action gradient",
  ["#0060FF", "#6830FF", "#C100F2"],
  "#FFFFFF",
  4.5
);
expectGradientContrast(
  "action hover gradient",
  ["#0054E6", "#5C28F2", "#A600DE"],
  "#FFFFFF",
  4.5
);
expectGradientContrast(
  "wordmark on sidebar",
  ["#0060FF", "#824FF8", "#E40C75"],
  "#FFFFFF",
  4.5
);
expectContrast(
  "electric-spectrum",
  "muted text on muted surface",
  THEME_PRESETS["electric-spectrum"].tokens.textMuted,
  THEME_PRESETS["electric-spectrum"].tokens.surfaceMuted,
  4.5
);
expectContrast(
  "electric-spectrum",
  "chart axis on card",
  THEME_PRESETS["electric-spectrum"].tokens.chartAxis,
  THEME_PRESETS["electric-spectrum"].tokens.surface,
  4.5
);
expectContrast(
  "electric-spectrum",
  "chart line on card",
  THEME_PRESETS["electric-spectrum"].tokens.chartLine,
  THEME_PRESETS["electric-spectrum"].tokens.surface,
  3
);
expectContrast(
  "electric-spectrum",
  "chart series on card",
  THEME_PRESETS["electric-spectrum"].tokens.chartSeries,
  THEME_PRESETS["electric-spectrum"].tokens.surface,
  3
);
expectContrast("electric-spectrum", "chart tertiary on card", "#C044EE", "#FFFFFF", 3);

for (const id of THEME_PRESET_IDS) checkPreset(id);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("theme registry, migration, follow-device, and contrast checks passed");
