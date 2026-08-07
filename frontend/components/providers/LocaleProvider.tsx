"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import {
  DATE_FORMATS,
  getMessages,
  languageMeta,
  resolveLanguage,
  translate,
  type DateFormat,
  type MessageKey,
  type Messages,
  type SupportedLanguage,
} from "@/lib/i18n";
import {
  dateKeyInTimezone,
  formatChartDate,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatMonthYear,
  formatTime,
  formatTodayLabelShort,
  fmtMoney,
  type LocalePrefs,
} from "@/lib/locale-format";

export type LocalePreview = Partial<{
  language: string;
  timezone: string;
  dateFormat: DateFormat;
}>;

type LocaleContextValue = {
  language: SupportedLanguage;
  timezone: string;
  dateFormat: DateFormat;
  locale: string;
  dir: "ltr" | "rtl";
  messages: Messages;
  prefs: LocalePrefs;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setPreview: (preview: LocalePreview | null) => void;
  formatDate: (value: Date | string | number | null | undefined) => string;
  formatTime: (value: Date | string | number | null | undefined) => string;
  formatDateTime: (value: Date | string | number | null | undefined) => string;
  formatDateLong: (value: Date | string | number | null | undefined) => string;
  formatTodayLabelShort: (value?: Date) => string;
  formatChartDate: (value: Date | string | number, style?: "short" | "monthYear") => string;
  formatMonthYear: (value: Date | string | number) => string;
  dateKey: (value: Date | string | number) => string;
  fmtMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function resolveDateFormat(value?: string | null): DateFormat {
  if (value && (DATE_FORMATS as readonly string[]).includes(value)) return value as DateFormat;
  return "MM/DD/YYYY";
}

function resolveTimezone(value?: string | null): string {
  if (value?.trim()) return value.trim();
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [preview, setPreviewState] = useState<LocalePreview | null>(null);

  const language = resolveLanguage(preview?.language ?? user?.language);
  const timezone = resolveTimezone(preview?.timezone ?? user?.timezone);
  const dateFormat = resolveDateFormat(preview?.dateFormat ?? user?.date_format);
  const meta = languageMeta(language);
  const messages = useMemo(() => getMessages(language), [language]);
  const prefs = useMemo<LocalePrefs>(
    () => ({ language, timezone, dateFormat }),
    [language, timezone, dateFormat]
  );

  const setPreview = useCallback((next: LocalePreview | null) => {
    setPreviewState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(messages, key, vars),
    [messages]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = meta.locale;
    document.documentElement.dir = meta.dir;
  }, [meta.locale, meta.dir]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      language,
      timezone,
      dateFormat,
      locale: meta.locale,
      dir: meta.dir,
      messages,
      prefs,
      t,
      setPreview,
      formatDate: (v) => formatDate(v, prefs),
      formatTime: (v) => formatTime(v, prefs),
      formatDateTime: (v) => formatDateTime(v, prefs),
      formatDateLong: (v) => formatDateLong(v, prefs),
      formatTodayLabelShort: (v) => formatTodayLabelShort(prefs, v),
      formatChartDate: (v, style) => formatChartDate(v, prefs, style),
      formatMonthYear: (v) => formatMonthYear(v, prefs),
      dateKey: (v) => dateKeyInTimezone(v, timezone),
      fmtMoney: (n, opts) => fmtMoney(n, prefs, opts),
    }),
    [language, timezone, dateFormat, meta.locale, meta.dir, messages, prefs, t, setPreview]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
