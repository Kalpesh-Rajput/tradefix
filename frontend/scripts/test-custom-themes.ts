/**
 * Custom theme studio: tokens, color sync, history, contrast, and preset isolation.
 * Run: npx --yes tsx scripts/test-custom-themes.ts
 */
import assert from "node:assert/strict";

import {
  canonicalColor,
  changedTokenIds,
  colorChannels,
  CONTRAST_PAIRS,
  cssForCustom,
  evaluateContrast,
  historyInit,
  historyPush,
  historyRedo,
  historyUndo,
  hslToColor,
  measureContrast,
  normalizeTokens,
  parseCssColor,
  parseImportedTheme,
  resetGroup,
  resetToken,
  rgbToColor,
  seedColors,
  serializeThemeExport,
  suggestAccessibleColor,
  validateThemeName,
} from "../lib/custom-theme";
import { CUSTOM_THEME_TOKEN_IDS, CUSTOM_THEME_TOKENS, TOKEN_GROUPS } from "../lib/custom-theme-tokens";
import { cssVariablesFor, isCustomThemeId, migrateStoredTheme, THEME_PRESET_IDS, THEME_PRESETS } from "../lib/theme-registry";

const groups = new Set(TOKEN_GROUPS.map((group) => group.id));
for (const token of CUSTOM_THEME_TOKENS) {
  assert.ok(groups.has(token.group), token.id);
  assert.ok(token.label.length > 0 && token.description.length > 0, token.id);
}
for (const id of [
  "primary",
  "primaryHover",
  "primaryForeground",
  "background",
  "surface",
  "dialog",
  "overlay",
  "textPrimary",
  "textMuted",
  "border",
  "sidebar",
  "sidebarActive",
  "header",
  "inputBg",
  "placeholder",
  "successText",
  "dangerText",
  "warningText",
  "infoText",
  "pnlPositive",
  "pnlNegative",
  "breakeven",
  "chartGrid",
  "chartAxis",
  "chartLine",
  "chartProfit",
  "chartLoss",
  "chartDrawdown",
  "chartSeries",
  "tableHeader",
  "tooltipTitle",
  "gradientStart",
]) {
  assert.ok(CUSTOM_THEME_TOKEN_IDS.includes(id), id);
}

const purpleSeed = seedColors("tradefix-purple");
const purpleCss = cssForCustom("tradefix-purple", purpleSeed);
const purpleBase = cssVariablesFor("tradefix-purple");
assert.equal(purpleCss["--color-primary"], purpleBase["--color-primary"]);
assert.equal(purpleCss["--primary"], purpleBase["--primary"]);
assert.equal(purpleCss["--positive"], purpleBase["--positive"]);
assert.equal(purpleCss["--color-chart-profit"], purpleBase["--color-chart-profit"]);
assert.equal(purpleCss["--color-chart-loss"], purpleBase["--color-chart-loss"]);
assert.equal(purpleCss["--muted"], purpleBase["--muted"]);
assert.equal(purpleCss["--focus-ring"], purpleBase["--focus-ring"]);

const midnightSeed = seedColors("midnight-pro");
const midnightCss = cssForCustom("midnight-pro", midnightSeed);
const midnightBase = cssVariablesFor("midnight-pro");
assert.equal(midnightCss["--color-background"], midnightBase["--color-background"]);
assert.equal(midnightCss["--color-primary"], midnightBase["--color-primary"]);
assert.equal(midnightCss["--primary"], midnightBase["--primary"]);
assert.equal(midnightCss["--color-chart-profit"], midnightBase["--color-chart-profit"]);

const edited = { ...purpleSeed, primary: "#112233" };
const editedCss = cssForCustom("tradefix-purple", edited);
assert.equal(editedCss["--color-primary"], "#112233");
assert.equal(editedCss["--accent-hex"], "#112233");
assert.notEqual(editedCss["--primary"], purpleBase["--primary"]);
assert.equal(editedCss["--color-chart-profit"], purpleBase["--color-chart-profit"]);
assert.equal(editedCss["--color-success-text"], purpleBase["--color-success-text"]);
assert.equal(editedCss["--color-primary-hover"], purpleBase["--color-primary-hover"]);

const spectrum = cssForCustom("electric-spectrum", seedColors("electric-spectrum"));
assert.equal(spectrum["--spectrum-gradient"], cssVariablesFor("electric-spectrum")["--spectrum-gradient"]);
const spectrumEdited = { ...seedColors("electric-spectrum"), gradientStart: "#001122", gradientMiddle: "#334455", gradientEnd: "#667788" };
const spectrumCss = cssForCustom("electric-spectrum", spectrumEdited);
assert.match(spectrumCss["--spectrum-gradient"], /#001122/i);
assert.match(spectrumCss["--spectrum-gradient"], /linear-gradient\(100deg/);

assert.equal(canonicalColor("#abc"), "#AABBCC");
assert.equal(canonicalColor("#aabbcc"), "#AABBCC");
assert.equal(canonicalColor("rgb(170, 187, 204)"), "#AABBCC");
assert.equal(hslToColor(0, 0, 0), "#000000");
assert.equal(hslToColor(0, 100, 50), "#FF0000");
assert.equal(rgbToColor(170, 187, 204), "#AABBCC");
assert.equal(parseCssColor("#12"), null);
assert.equal(parseCssColor("red"), null);
assert.equal(parseCssColor("rgb(999, 0, 0)"), null);
const channels = colorChannels("#112233");
assert.ok(channels);
assert.equal(channels.rgb.r, 17);
assert.equal(rgbToColor(channels.rgb.r, channels.rgb.g, channels.rgb.b), "#112233");

let history = historyInit(purpleSeed);
history = historyPush(history, { ...purpleSeed, primary: "#000000" });
history = historyPush(history, { ...purpleSeed, primary: "#FFFFFF" });
assert.equal(history.present.primary, "#FFFFFF");
history = historyUndo(history);
assert.equal(history.present.primary, "#000000");
history = historyRedo(history);
assert.equal(history.present.primary, "#FFFFFF");
const emptyHistory = historyInit(purpleSeed);
assert.equal(historyUndo(emptyHistory), emptyHistory);
assert.equal(historyRedo(emptyHistory), emptyHistory);

const reset = resetToken({ ...purpleSeed, primary: "#000000" }, "tradefix-purple", "primary");
assert.equal(reset.primary, purpleSeed.primary);
assert.equal(reset.background, purpleSeed.background);
const groupReset = resetGroup({ ...purpleSeed, primary: "#000000", primaryHover: "#111111", chartProfit: "#222222" }, "tradefix-purple", "brand");
assert.equal(groupReset.primary, purpleSeed.primary);
assert.equal(groupReset.primaryHover, purpleSeed.primaryHover);
assert.equal(groupReset.chartProfit, "#222222");
assert.deepEqual(changedTokenIds("tradefix-purple", { ...purpleSeed, chartLoss: "#010101" }), ["chartLoss"]);

assert.ok((measureContrast("#000000", "#FFFFFF") ?? 0) > 20);
assert.ok((measureContrast("#FFFFFF", "#FFFFFF") ?? 1) < 1.1);
assert.equal(suggestAccessibleColor("#000000", "#FFFFFF", 4.5), null);
const suggestion = suggestAccessibleColor("#777777", "#FFFFFF", 4.5);
assert.ok(suggestion);
assert.ok((measureContrast(suggestion, "#FFFFFF") ?? 0) >= 4.5);
const report = evaluateContrast(purpleSeed);
assert.equal(report.length, CONTRAST_PAIRS.length);
assert.ok(report.some((item) => item.pair.id === "primary-button"));

assert.equal(validateThemeName("  ", []), "Enter a theme name.");
assert.equal(validateThemeName("Mine", [{ id: "ct_0123456789ab", name: "mine" }]), "You already have a custom theme with this name.");
assert.equal(validateThemeName("Mine", [{ id: "ct_0123456789ab", name: "mine" }], "ct_0123456789ab"), null);

const exported = serializeThemeExport({
  id: "ct_0123456789ab",
  name: "Desk",
  base_theme_id: "classic",
  mode: "light",
  tokens: purpleSeed,
  schema_version: 1,
});
assert.equal(exported.kind, "tradefix-custom-theme");
assert.equal("email" in exported, false);
const imported = parseImportedTheme(exported, "midnight-pro");
assert.equal(imported.ok, true);
if (imported.ok) assert.equal(imported.baseThemeId, "classic");
assert.equal(parseImportedTheme({ kind: "other" }, "classic").ok, false);
assert.equal(parseImportedTheme({ kind: exported.kind, schemaVersion: 1, name: "Desk", baseThemeId: "classic", tokens: { primary: "nope" } }, "classic").ok, false);
const partial = parseImportedTheme(
  { kind: exported.kind, schemaVersion: 1, name: "Desk", baseThemeId: "not-a-theme", tokens: { primary: "#112233" } },
  "midnight-pro"
);
assert.equal(partial.ok, true);
if (partial.ok) {
  assert.equal(partial.baseThemeId, "midnight-pro");
  assert.equal(partial.tokens.primary, "#112233");
  assert.equal(partial.tokens.background, seedColors("midnight-pro").background);
}

assert.equal(migrateStoredTheme("ct_0123456789ab"), "ct_0123456789ab");
assert.equal(isCustomThemeId("ct_0123456789ab"), true);
assert.equal(isCustomThemeId("tradefix-purple"), false);
assert.equal(migrateStoredTheme("nope"), "tradefix-purple");
assert.equal(normalizeTokens("classic", { primary: "#abc" }).primary, "#AABBCC");

for (const id of THEME_PRESET_IDS) {
  assert.equal(THEME_PRESETS[id].tokens.chartProfit.startsWith("#"), true);
  const untouched = cssForCustom(id, seedColors(id));
  assert.equal(untouched["--color-primary"], cssVariablesFor(id)["--color-primary"], id);
  assert.equal(untouched["--color-chart-profit"], cssVariablesFor(id)["--color-chart-profit"], id);
}

console.log(`custom theme checks passed (${CUSTOM_THEME_TOKENS.length} tokens)`);
