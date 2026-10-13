"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ThemeStudioRoot } from "@/components/theme/ThemeStudioRoot";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  applyAppearanceToDocument,
  applyPreviewCss,
  DEFAULT_APPEARANCE,
  isAccentColor,
  migrateStoredTheme,
  readStoredAppearance,
  readStoredCustomThemes,
  resolveSaveResult,
  resolveTheme,
  THEME_PRESETS,
  writeStoredAppearance,
  type AccentColor,
  type AppearanceState,
  type StoredCustomThemes,
} from "@/lib/appearance";
import {
  buildCustomTheme,
  CUSTOM_THEME_LIMIT,
  duplicateThemeName,
  modeForColors,
  opaqueHex,
  parseCustomThemesDocument,
  validateThemeName,
  type ColorMap,
  type CustomThemeRecord,
} from "@/lib/custom-theme";
import { isCustomThemeId, type ThemePresetId } from "@/lib/theme-registry";

export type StudioLaunch = { mode: "create" } | { mode: "edit"; id: string };

type AppearanceContextValue = {
  theme: string;
  resolvedTheme: string;
  mode: "light" | "dark";
  themeLabel: string;
  accent: AccentColor;
  accentHex: string;
  setTheme: (theme: string) => Promise<void>;
  saving: boolean;
  customThemes: CustomThemeRecord[];
  customRevision: number;
  semanticChrome: boolean;
  openThemeStudio: (launch: StudioLaunch) => void;
  studio: StudioLaunch | null;
  closeThemeStudio: () => void;
  saveCustomTheme: (input: { record: CustomThemeRecord; apply: boolean }) => Promise<void>;
  deleteCustomTheme: (id: string) => Promise<void>;
  duplicateCustomTheme: (id: string) => Promise<CustomThemeRecord>;
  setLivePreview: (draft: { baseThemeId: ThemePresetId; colors: ColorMap } | null) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function normalizeAccent(value: unknown): AccentColor {
  if (value === "teal" || value === "emerald" || value === "green") return "purple";
  return isAccentColor(value) ? value : DEFAULT_APPEARANCE.accent;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [state, setState] = useState<AppearanceState>(DEFAULT_APPEARANCE);
  const [customThemes, setCustomThemes] = useState<CustomThemeRecord[]>([]);
  const [customRevision, setCustomRevision] = useState(0);
  const [systemDark, setSystemDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studio, setStudio] = useState<StudioLaunch | null>(null);
  const [previewAccent, setPreviewAccent] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"light" | "dark" | null>(null);
  const syncedUserId = useRef<string | null>(null);
  const requestId = useRef(0);
  const acknowledged = useRef<AppearanceState>(DEFAULT_APPEARANCE);
  const acknowledgedCustom = useRef<StoredCustomThemes>({ themes: [], revision: 0 });
  const stateRef = useRef(state);
  const themesRef = useRef<CustomThemeRecord[]>([]);
  const revisionRef = useRef(0);
  const systemDarkRef = useRef(false);
  const previewRef = useRef<{ baseThemeId: ThemePresetId; colors: ColorMap } | null>(null);
  stateRef.current = state;

  const apply = useCallback((next: AppearanceState, custom?: StoredCustomThemes, prefersDark?: boolean) => {
    const themes = custom?.themes ?? themesRef.current;
    const revision = custom?.revision ?? revisionRef.current;
    if (custom) {
      themesRef.current = custom.themes;
      revisionRef.current = custom.revision;
      setCustomThemes(custom.themes);
      setCustomRevision(custom.revision);
    }
    setState(next);
    stateRef.current = next;
    writeStoredAppearance(next, { themes, revision });
    if (previewRef.current) return;
    applyAppearanceToDocument(next, prefersDark ?? systemDarkRef.current, themes);
  }, []);

  useEffect(() => {
    const stored = readStoredAppearance();
    const custom = readStoredCustomThemes();
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    systemDarkRef.current = dark;
    setSystemDark(dark);
    acknowledged.current = stored;
    acknowledgedCustom.current = custom;
    apply(stored, custom, dark);
    setHydrated(true);
  }, [apply]);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;

    const documentThemes = parseCustomThemesDocument(user.custom_themes);
    const custom = { themes: documentThemes.themes, revision: documentThemes.revision };
    const theme = migrateStoredTheme(user.theme);
    const safeTheme =
      isCustomThemeId(theme) && !custom.themes.some((item) => item.id === theme) ? DEFAULT_APPEARANCE.theme : theme;
    const server: AppearanceState = {
      theme: safeTheme,
      accent: normalizeAccent(user.accent_color),
    };
    acknowledged.current = server;
    acknowledgedCustom.current = custom;
    apply(server, custom);

    if (user.theme !== safeTheme) {
      updateProfile({ theme: safeTheme }).catch(() => {
        /* local copy already matches the migrated preference */
      });
    }
  }, [hydrated, user, apply, updateProfile]);

  useEffect(() => {
    if (!hydrated || state.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      systemDarkRef.current = mq.matches;
      setSystemDark(mq.matches);
      if (!previewRef.current) applyAppearanceToDocument(stateRef.current, mq.matches, themesRef.current);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated, state.theme]);

  const setLivePreview = useCallback((draft: { baseThemeId: ThemePresetId; colors: ColorMap } | null) => {
    previewRef.current = draft;
    if (!draft) {
      setPreviewAccent(null);
      setPreviewMode(null);
      applyAppearanceToDocument(stateRef.current, systemDarkRef.current, themesRef.current);
      return;
    }
    applyPreviewCss(draft.baseThemeId, draft.colors);
    setPreviewAccent(opaqueHex(draft.colors.primary));
    setPreviewMode(modeForColors(draft.baseThemeId, draft.colors));
  }, []);

  const persistCustom = useCallback(
    async (themes: CustomThemeRecord[], theme: string) => {
      const id = ++requestId.current;
      const revision = revisionRef.current;
      if (!user) {
        const next = { ...stateRef.current, theme };
        if (resolveSaveResult(id, requestId.current, true) === "commit") {
          previewRef.current = null;
          setPreviewAccent(null);
          setPreviewMode(null);
          apply(next, { themes, revision });
          acknowledged.current = next;
          acknowledgedCustom.current = { themes, revision };
        }
        return;
      }
      setSaving(true);
      try {
        const updated = await updateProfile({ custom_themes: { revision, themes }, theme });
        if (resolveSaveResult(id, requestId.current, true) !== "commit") return;
        const documentThemes = parseCustomThemesDocument(updated.custom_themes);
        const custom = { themes: documentThemes.themes, revision: documentThemes.revision };
        const next: AppearanceState = {
          theme: migrateStoredTheme(updated.theme),
          accent: normalizeAccent(updated.accent_color),
        };
        previewRef.current = null;
        setPreviewAccent(null);
        setPreviewMode(null);
        apply(next, custom);
        acknowledged.current = next;
        acknowledgedCustom.current = custom;
      } catch (error) {
        if (resolveSaveResult(id, requestId.current, false) === "revert") {
          previewRef.current = null;
          setPreviewAccent(null);
          setPreviewMode(null);
          apply(acknowledged.current, acknowledgedCustom.current);
        }
        throw error;
      } finally {
        if (id === requestId.current) setSaving(false);
      }
    },
    [apply, updateProfile, user]
  );

  const setTheme = useCallback(
    async (theme: string) => {
      if (isCustomThemeId(theme) && !themesRef.current.some((item) => item.id === theme)) {
        throw new Error("That custom theme is no longer available.");
      }
      const id = ++requestId.current;
      const next: AppearanceState = { ...stateRef.current, theme };
      previewRef.current = null;
      setPreviewAccent(null);
      setPreviewMode(null);
      apply(next);
      if (!user) {
        if (resolveSaveResult(id, requestId.current, true) === "commit") acknowledged.current = next;
        return;
      }
      setSaving(true);
      try {
        await updateProfile({ theme });
        if (resolveSaveResult(id, requestId.current, true) === "commit") acknowledged.current = next;
      } catch (err) {
        if (resolveSaveResult(id, requestId.current, false) === "revert") apply(acknowledged.current);
        throw err;
      } finally {
        if (id === requestId.current) setSaving(false);
      }
    },
    [apply, updateProfile, user]
  );

  const saveCustomTheme = useCallback(
    async ({ record, apply: makeActive }: { record: CustomThemeRecord; apply: boolean }) => {
      const nameError = validateThemeName(record.name, themesRef.current, record.id);
      if (nameError) throw new Error(nameError);
      const exists = themesRef.current.some((item) => item.id === record.id);
      if (!exists && themesRef.current.length >= CUSTOM_THEME_LIMIT) {
        throw new Error(`You can save up to ${CUSTOM_THEME_LIMIT} custom themes. Delete one to save another.`);
      }
      const themes = exists
        ? themesRef.current.map((item) => (item.id === record.id ? record : item))
        : [...themesRef.current, record];
      const theme = makeActive ? record.id : stateRef.current.theme === record.id ? record.id : stateRef.current.theme;
      await persistCustom(themes, theme);
    },
    [persistCustom]
  );

  const deleteCustomTheme = useCallback(
    async (id: string) => {
      const current = themesRef.current.find((item) => item.id === id);
      if (!current) return;
      const themes = themesRef.current.filter((item) => item.id !== id);
      const theme = stateRef.current.theme === id ? current.base_theme_id : stateRef.current.theme;
      await persistCustom(themes, theme);
    },
    [persistCustom]
  );

  const duplicateCustomTheme = useCallback(
    async (id: string) => {
      const source = themesRef.current.find((item) => item.id === id);
      if (!source) throw new Error("That custom theme is no longer available.");
      if (themesRef.current.length >= CUSTOM_THEME_LIMIT) {
        throw new Error(`You can save up to ${CUSTOM_THEME_LIMIT} custom themes. Delete one to duplicate another.`);
      }
      const copy = buildCustomTheme({
        name: duplicateThemeName(source.name, themesRef.current),
        baseThemeId: source.base_theme_id,
        tokens: source.tokens,
      });
      await persistCustom([...themesRef.current, copy], stateRef.current.theme);
      return copy;
    },
    [persistCustom]
  );

  const activeCustom = isCustomThemeId(state.theme) ? customThemes.find((item) => item.id === state.theme) : undefined;
  const resolvedPreset = resolveTheme(state.theme, systemDark);
  const resolvedTheme = activeCustom?.id ?? resolvedPreset;
  const mode = previewMode ?? activeCustom?.mode ?? THEME_PRESETS[resolvedPreset].mode;
  const themeLabel =
    state.theme === "system" ? "Follow device" : activeCustom?.name ?? THEME_PRESETS[resolvedPreset].name;
  const accentHex = previewAccent ?? activeCustom?.tokens.primary ?? THEME_PRESETS[resolvedPreset].tokens.primary;
  const semanticChrome = previewMode != null || Boolean(activeCustom);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      theme: state.theme,
      resolvedTheme,
      mode,
      themeLabel,
      accent: state.accent,
      accentHex,
      setTheme,
      saving,
      customThemes,
      customRevision,
      semanticChrome,
      openThemeStudio: setStudio,
      studio,
      closeThemeStudio: () => setStudio(null),
      saveCustomTheme,
      deleteCustomTheme,
      duplicateCustomTheme,
      setLivePreview,
    }),
    [
      state,
      resolvedTheme,
      mode,
      themeLabel,
      accentHex,
      setTheme,
      saving,
      customThemes,
      customRevision,
      semanticChrome,
      studio,
      saveCustomTheme,
      deleteCustomTheme,
      duplicateCustomTheme,
      setLivePreview,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
      <ThemeStudioRoot />
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
