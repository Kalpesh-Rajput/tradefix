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
  ACCENT_PALETTE,
  applyAppearanceToDocument,
  DEFAULT_APPEARANCE,
  isAccentColor,
  isThemePreference,
  readStoredAppearance,
  writeStoredAppearance,
  type AccentColor,
  type AppearanceState,
  type ThemePreference,
} from "@/lib/appearance";

type AppearanceContextValue = {
  theme: ThemePreference;
  accent: AccentColor;
  accentHex: string;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setAccent: (accent: AccentColor) => Promise<void>;
  saving: boolean;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isDefaultAppearance(state: AppearanceState) {
  return state.theme === "dark" && state.accent === "teal";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [state, setState] = useState<AppearanceState>(DEFAULT_APPEARANCE);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const syncedUserId = useRef<string | null>(null);

  const apply = useCallback((next: AppearanceState) => {
    setState(next);
    writeStoredAppearance(next);
    applyAppearanceToDocument(next);
  }, []);

  useEffect(() => {
    apply(readStoredAppearance());
    setHydrated(true);
  }, [apply]);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (syncedUserId.current === user.id) return;

    const server: AppearanceState = {
      theme: isThemePreference(user.theme) ? user.theme : "dark",
      accent: isAccentColor(user.accent_color) ? user.accent_color : "teal",
    };
    const stored = readStoredAppearance();

    // Keep a custom local choice if the account is still on defaults, then upload it.
    if (isDefaultAppearance(server) && !isDefaultAppearance(stored)) {
      syncedUserId.current = user.id;
      apply(stored);
      updateProfile({ theme: stored.theme, accent_color: stored.accent }).catch(() => {
        /* local preview remains */
      });
      return;
    }

    syncedUserId.current = user.id;
    apply(server);
  }, [hydrated, user, apply, updateProfile]);

  useEffect(() => {
    if (!hydrated || state.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearanceToDocument(state, mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated, state]);

  const persist = useCallback(
    async (next: AppearanceState) => {
      apply(next);
      if (!user) return;
      setSaving(true);
      try {
        await updateProfile({ theme: next.theme, accent_color: next.accent });
      } finally {
        setSaving(false);
      }
    },
    [apply, updateProfile, user]
  );

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      await persist({ ...state, theme });
    },
    [persist, state]
  );

  const setAccent = useCallback(
    async (accent: AccentColor) => {
      await persist({ ...state, accent });
    },
    [persist, state]
  );

  const value = useMemo<AppearanceContextValue>(
    () => ({
      theme: state.theme,
      accent: state.accent,
      accentHex: ACCENT_PALETTE[state.accent]?.hex ?? ACCENT_PALETTE.teal.hex,
      setTheme,
      setAccent,
      saving,
    }),
    [state, setTheme, setAccent, saving]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
