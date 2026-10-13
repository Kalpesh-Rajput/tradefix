"use client";

import clsx from "clsx";
import { Palette, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { ColorTokenRow } from "@/components/theme/ColorTokenRow";
import { ContrastPanel } from "@/components/theme/ContrastPanel";
import { ThemeLivePreview } from "@/components/theme/ThemeLivePreview";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  buildCustomTheme,
  changedTokenIds,
  CUSTOM_THEME_LIMIT,
  downloadThemeFile,
  historyInit,
  historyPush,
  historyRedo,
  historyUndo,
  normalizeTokens,
  parseImportedTheme,
  resetGroup,
  resetToken,
  sameColors,
  searchTokens,
  seedColors,
  validateThemeName,
  evaluateContrast,
  type EditHistory,
} from "@/lib/custom-theme";
import { TOKEN_GROUPS, type TokenGroupId } from "@/lib/custom-theme-tokens";
import { isCustomThemeId, isThemePresetId, THEME_PRESETS, type ThemePresetId } from "@/lib/theme-registry";

export function CustomThemeStudio({
  launch,
  onClose,
}: {
  launch: { mode: "create" } | { mode: "edit"; id: string };
  onClose: () => void;
}) {
  const appearance = useAppearance();
  const toast = useToast();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [start] = useState(() => initialDraft(launch, appearance));
  const [name, setName] = useState(start.name);
  const [baseId, setBaseId] = useState<ThemePresetId>(start.baseId);
  const [startFrom, setStartFrom] = useState<string>(start.baseId);
  const [history, setHistory] = useState<EditHistory>(() => historyInit(start.colors));
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<TokenGroupId | "all">("brand");
  const [live, setLive] = useState(false);
  const [applyOnSave, setApplyOnSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const editingId = launch.mode === "edit" ? launch.id : undefined;
  const colors = history.present;
  const dirty = name.trim() !== start.name || !sameColors(colors, start.colors) || baseId !== start.baseId;
  const changed = new Set(changedTokenIds(baseId, colors));
  const visible = useMemo(() => {
    const matches = searchTokens(query);
    return group === "all" || query.trim() ? matches : matches.filter((token) => token.group === group);
  }, [group, query]);
  const nameError = validateThemeName(name, appearance.customThemes, editingId);
  const atLimit = !editingId && appearance.customThemes.length >= CUSTOM_THEME_LIMIT;

  const setLivePreview = appearance.setLivePreview;
  const contrastFailures = useMemo(() => evaluateContrast(colors).filter((result) => !result.pass).length, [colors]);

  useEffect(() => {
    if (!live) return;
    setLivePreview({ baseThemeId: baseId, colors });
  }, [setLivePreview, baseId, colors, live]);

  useEffect(() => {
    if (live) return;
    setLivePreview(null);
  }, [live, setLivePreview]);

  useEffect(() => () => setLivePreview(null), [setLivePreview]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        setHistory((current) => (event.shiftKey ? historyRedo(current) : historyUndo(current)));
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (dirty) setConfirmClose(true);
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dirty, onClose]);

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  function editColor(tokenId: string, next: string) {
    setHistory((current) => historyPush(current, { ...current.present, [tokenId]: next }));
  }

  function changeBase(nextBase: ThemePresetId, nextColors = seedColors(nextBase), sourceId: string = nextBase) {
    setStartFrom(sourceId);
    setBaseId(nextBase);
    setHistory(historyInit(normalizeTokens(nextBase, nextColors)));
    setConfirmReset(false);
  }

  function resetAll() {
    setHistory((current) => historyPush(current, seedColors(baseId)));
    setConfirmReset(false);
  }

  async function save() {
    if (nameError || atLimit) {
      setError(nameError ?? `You can save up to ${CUSTOM_THEME_LIMIT} custom themes.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const record = buildCustomTheme({ id: editingId, name, baseThemeId: baseId, tokens: colors });
      await appearance.saveCustomTheme({ record, apply: applyOnSave || appearance.theme === record.id });
      toast.success(applyOnSave ? "Theme saved and applied" : "Theme saved");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save this theme.";
      setError(message);
      toast.error("Could not save theme", message);
    } finally {
      setSaving(false);
    }
  }

  async function importFile(file: File) {
    try {
      const parsed = parseImportedTheme(JSON.parse(await file.text()), baseId);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      setName(parsed.name);
      changeBase(parsed.baseThemeId, parsed.tokens);
      setError("");
      toast.success("Theme imported", "Review the colors, then save.");
    } catch {
      setError("This file is not valid JSON.");
    }
  }

  const baseName = THEME_PRESETS[baseId].name;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close custom theme studio" onClick={requestClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100dvh] w-full flex-col bg-surface text-foreground sm:h-[min(920px,calc(100dvh-2rem))] sm:max-w-6xl sm:rounded-xl sm:border sm:border-border sm:shadow-dropdown"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-primary" aria-hidden />
              <h2 id={titleId} className="text-base font-semibold">
                Custom Theme Studio
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted">Choose every color. Built-in themes stay unchanged.</p>
          </div>
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2" aria-label="Close" onClick={requestClose}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border px-4 py-3">
          <label className="min-w-[12rem] flex-1 text-xs font-medium text-muted">
            Theme name
            <input
              value={name}
              maxLength={48}
              autoFocus
              className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-primary"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="min-w-[12rem] flex-1 text-xs font-medium text-muted">
            Start from
            <select
              value={startFrom}
              className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
              onChange={(event) => {
                const value = event.target.value;
                if (isCustomThemeId(value)) {
                  const source = appearance.customThemes.find((theme) => theme.id === value);
                  if (source) changeBase(source.base_theme_id, source.tokens, source.id);
                  return;
                }
                if (isThemePresetId(value)) changeBase(value);
              }}
            >
              <optgroup label="Built-in themes">
                {Object.values(THEME_PRESETS).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              {appearance.customThemes.length > 0 && (
                <optgroup label="My custom themes">
                  {appearance.customThemes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <p className="pb-2 text-xs text-muted">Base: {baseName}</p>
          <div className="ml-auto flex gap-1 pb-0.5">
            <IconAction label="Undo" disabled={history.past.length === 0} onClick={() => setHistory(historyUndo)}>
              <Undo2 className="h-4 w-4" />
            </IconAction>
            <IconAction label="Redo" disabled={history.future.length === 0} onClick={() => setHistory(historyRedo)}>
              <Redo2 className="h-4 w-4" />
            </IconAction>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-border lg:border-r">
            <div className="shrink-0 space-y-2 border-b border-border p-3">
              <input
                value={query}
                placeholder="Search colors"
                aria-label="Search colors"
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary"
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Color groups">
                <GroupChip active={group === "all"} onClick={() => setGroup("all")}>
                  All
                </GroupChip>
                {TOKEN_GROUPS.map((item) => (
                  <GroupChip key={item.id} active={group === item.id} onClick={() => setGroup(item.id)}>
                    {item.label}
                  </GroupChip>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {group !== "all" && !query.trim() && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setHistory((current) => historyPush(current, resetGroup(current.present, baseId, group)))}
                  >
                    Reset this group
                  </button>
                </div>
              )}
              {visible.map((token) => (
                <ColorTokenRow
                  key={token.id}
                  token={token}
                  value={colors[token.id]}
                  changed={changed.has(token.id)}
                  onChange={(next) => editColor(token.id, next)}
                  onReset={() => setHistory((current) => historyPush(current, resetToken(current.present, baseId, token.id)))}
                />
              ))}
              {visible.length === 0 && <p className="text-sm text-muted">No colors match that search.</p>}
              <ContrastPanel colors={colors} onApplyFix={(tokenId, color) => editColor(tokenId, color)} />
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto bg-background-subtle p-3 sm:p-4">
            <p className="mb-2 text-xs font-medium text-muted">Live preview</p>
            <ThemeLivePreview baseThemeId={baseId} colors={colors} />
          </div>
        </div>

        <footer className="shrink-0 space-y-2 border-t border-border px-4 py-3">
          {error && <p className="text-xs text-destructive">{error}</p>}
          {confirmReset && (
            <p className="text-xs text-foreground">
              Reset every color to {baseName}?{" "}
              <button type="button" className="font-semibold text-primary" onClick={resetAll}>
                Reset
              </button>{" "}
              <button type="button" className="text-muted" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </p>
          )}
          {confirmClose && (
            <p className="text-xs text-foreground">
              Discard unsaved color changes?{" "}
              <button type="button" className="font-semibold text-destructive" onClick={onClose}>
                Discard
              </button>{" "}
              <button type="button" className="text-muted" onClick={() => setConfirmClose(false)}>
                Keep editing
              </button>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={history.past.length === 0} onClick={() => setHistory(historyUndo)}>
              Undo
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={history.future.length === 0} onClick={() => setHistory(historyRedo)}>
              Redo
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => (changed.size ? setConfirmReset(true) : resetAll())}>
              Reset colors
            </Button>
            <label className="ml-auto flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} />
              Preview on application
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={applyOnSave} onChange={(event) => setApplyOnSave(event.target.checked)} />
              Use this theme after saving
            </label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => downloadThemeFile(buildCustomTheme({ id: editingId, name: name.trim() || "Custom theme", baseThemeId: baseId, tokens: colors }))}
            >
              Export
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import theme file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importFile(file);
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={saving || Boolean(nameError) || atLimit} onClick={() => void save()}>
              {saving ? "Saving…" : "Save theme"}
            </Button>
          </div>
          {atLimit && <p className="text-xs text-muted">You can save {CUSTOM_THEME_LIMIT} custom themes. Delete one to create another.</p>}
          {contrastFailures > 0 && (
            <p className="text-xs text-muted">
              {contrastFailures} contrast {contrastFailures === 1 ? "check is" : "checks are"} below WCAG AA. You can still save this theme.
            </p>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}

function GroupChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={clsx(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border disabled:opacity-40"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function initialDraft(
  launch: { mode: "create" } | { mode: "edit"; id: string },
  appearance: ReturnType<typeof useAppearance>
) {
  if (launch.mode === "edit") {
    const theme = appearance.customThemes.find((item) => item.id === launch.id);
    if (theme) return { name: theme.name, baseId: theme.base_theme_id, colors: { ...theme.tokens } };
  }
  if (isCustomThemeId(appearance.theme)) {
    const active = appearance.customThemes.find((item) => item.id === appearance.theme);
    if (active) {
      return {
        name: unusedName(appearance.customThemes, active.name === "Custom theme" ? "Custom theme" : `${active.name} draft`),
        baseId: active.base_theme_id,
        colors: { ...active.tokens },
      };
    }
  }
  const baseId = isThemePresetId(appearance.resolvedTheme) ? appearance.resolvedTheme : "tradefix-purple";
  return { name: unusedName(appearance.customThemes, "Custom theme"), baseId, colors: seedColors(baseId) };
}

function unusedName(themes: { name: string }[], seed: string) {
  const taken = new Set(themes.map((theme) => theme.name.trim().toLowerCase()));
  if (!taken.has(seed.toLowerCase())) return seed.slice(0, 48);
  for (let index = 2; index < 50; index += 1) {
    const next = `${seed} ${index}`.slice(0, 48);
    if (!taken.has(next.toLowerCase())) return next;
  }
  return seed.slice(0, 48);
}
