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

import { useAuth } from "@/components/providers/AuthProvider";
import {
  applyAppearanceToDocument,
  DEFAULT_APPEARANCE,
  isAccentColor,
  migrateStoredTheme,
  readStoredAppearance,
  resolveSaveResult,
  resolveTheme,
  THEME_PRESETS,
  writeStoredAppearance,
  type AccentColor,
  type AppearanceState,
  type ThemePreference,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: ThemePreference;
  resolvedTheme: (typeof THEME_PRESETS)[keyof typeof THEME_PRESETS]["id"];
  accent: AccentColor;
  accentHex: string;
  setTheme: (theme: ThemePreference) => Promise<void>;
  saving: boolean;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function normalizeAccent(value: unknown): AccentColor {
  if (value === "teal" || value === "emerald" || value === "green") return "purple";
  return isAccentColor(value) ? value : DEFAULT_APPEARANCE.accent;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [state, setState] = useState<AppearanceState>(DEFAULT_APPEARANCE);
  const [systemDark, setSystemDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const syncedUserId = useRef<string | null>(null);
  const requestId = useRef(0);
  const acknowledged = useRef<AppearanceState>(DEFAULT_APPEARANCE);
  const stateRef = useRef(state);
  const systemDarkRef = useRef(false);
  stateRef.current = state;

  const apply = useCallback((next: AppearanceState, prefersDark?: boolean) => {
    const dark = prefersDark ?? systemDarkRef.current;
    setState(next);
    stateRef.current = next;
    writeStoredAppearance(next);
    applyAppearanceToDocument(next, dark);
  }, []);

  useEffect(() => {
    const stored = readStoredAppearance();
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    systemDarkRef.current = dark;
    setSystemDark(dark);
    acknowledged.current = stored;
    apply(stored, dark);
    setHydrated(true);
  }, [apply]);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;

    const theme = migrateStoredTheme(user.theme);
    const server: AppearanceState = {
      theme,
      accent: normalizeAccent(user.accent_color),
    };
    acknowledged.current = server;
    apply(server);

    if (user.theme !== theme) {
      updateProfile({ theme }).catch(() => {
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
      applyAppearanceToDocument(stateRef.current, mq.matches);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated, state.theme]);

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      const id = ++requestId.current;
      const next: AppearanceState = { ...stateRef.current, theme };
      apply(next);
      if (!user) {
        if (resolveSaveResult(id, requestId.current, true) === "commit") {
          acknowledged.current = next;
        }
        return;
      }
      setSaving(true);
      try {
        await updateProfile({ theme });
        if (resolveSaveResult(id, requestId.current, true) === "commit") {
          acknowledged.current = next;
        }
      } catch (err) {
        if (resolveSaveResult(id, requestId.current, false) === "revert") {
          apply(acknowledged.current);
        }
        throw err;
      } finally {
        if (id === requestId.current) setSaving(false);
      }
    },
    [apply, updateProfile, user]
  );

  const resolvedTheme = resolveTheme(state.theme, systemDark);
  const accentHex = THEME_PRESETS[resolvedTheme].tokens.primary;

  const value = useMemo<AppearanceContextValue>(
    () => ({
      theme: state.theme,
      resolvedTheme,
      accent: state.accent,
      accentHex,
      setTheme,
      saving,
    }),
    [state, resolvedTheme, accentHex, setTheme, saving]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
