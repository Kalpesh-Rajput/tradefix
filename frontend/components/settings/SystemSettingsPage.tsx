"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsSelect,
  SettingsShell,
  SettingsTextarea,
  SettingsToggle,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { DATE_FORMATS, type DateFormat } from "@/lib/i18n";
import { getLanguageOptions } from "@/lib/languages";
import { getTimezoneOptions } from "@/lib/timezones";

const systemSchema = z.object({
  timezone: z.string().min(1),
  language: z.string().min(1),
  date_format: z.enum(DATE_FORMATS),
  save_filters: z.boolean(),
  journal_template: z.string().max(10000).optional().or(z.literal("")),
});

type SystemFormValues = z.infer<typeof systemSchema>;

export function SystemSettingsPage() {
  const { user, loading, updateProfile } = useAuth();
  const { t, setPreview } = useLocale();
  const toast = useToast();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const languageOptions = useMemo(() => getLanguageOptions(), []);
  const timezoneValues = useMemo(() => new Set(timezoneOptions.map((o) => o.value)), [timezoneOptions]);
  const languageValues = useMemo(() => new Set(languageOptions.map((o) => o.value)), [languageOptions]);

  const defaults = useMemo<SystemFormValues>(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let timezone = user?.timezone || browserTz;
    if (!timezoneValues.has(timezone)) timezone = timezoneValues.has("UTC") ? "UTC" : timezoneOptions[0]?.value || "UTC";

    let language = user?.language || "en";
    if (!languageValues.has(language)) language = "en";

    const date_format = (DATE_FORMATS as readonly string[]).includes(user?.date_format || "")
      ? (user!.date_format as DateFormat)
      : "MM/DD/YYYY";

    return {
      timezone,
      language,
      date_format,
      save_filters: user?.save_filters ?? false,
      journal_template: user?.journal_template || "",
    };
  }, [user, timezoneOptions, timezoneValues, languageValues]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SystemFormValues>({
    resolver: zodResolver(systemSchema),
    defaultValues: defaults,
  });

  const watched = useWatch({ control });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  // Live-apply language / timezone / date format while editing (and clear on leave).
  useEffect(() => {
    if (!watched) return;
    setPreview({
      language: watched.language,
      timezone: watched.timezone,
      dateFormat: watched.date_format as DateFormat | undefined,
    });
  }, [watched?.language, watched?.timezone, watched?.date_format, setPreview]);

  useEffect(() => {
    return () => setPreview(null);
  }, [setPreview]);

  const onSubmit = handleSubmit(async (values) => {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      await updateProfile({
        timezone: values.timezone,
        language: values.language,
        date_format: values.date_format,
        save_filters: values.save_filters,
        journal_template: values.journal_template?.trim() || null,
      });
      setPreview(null);
      setSaveState("saved");
      toast.success(t("settings.system.savedToast"));
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : t("common.error");
      setErrorMsg(message);
      toast.error(t("settings.system.saveErrorToast"), message);
    }
  });

  function handleCancel() {
    reset(defaults);
    setPreview(null);
    setErrorMsg(null);
    setSaveState("idle");
  }

  if (loading && !user) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-48 rounded bg-white/5" />
          <div className="h-4 w-72 rounded bg-white/[0.04]" />
          <div className="h-56 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
          <div className="h-28 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader title={t("settings.system.title")} subtitle={t("settings.system.subtitle")} />

      <form onSubmit={onSubmit} className="space-y-5">
        <SettingsCard title={t("settings.system.timezoneCard")} description={t("settings.system.timezoneDesc")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsField
              label={t("settings.system.timezone")}
              error={errors.timezone ? t("settings.system.timezoneRequired") : undefined}
            >
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <SearchableSelect
                    options={timezoneOptions}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    searchPlaceholder={t("settings.system.searchTimezones")}
                    aria-label={t("settings.system.timezone")}
                  />
                )}
              />
            </SettingsField>

            <SettingsField
              label={t("settings.system.language")}
              error={errors.language ? t("settings.system.languageRequired") : undefined}
            >
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <SearchableSelect
                    options={languageOptions}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    searchPlaceholder={t("settings.system.searchLanguages")}
                    aria-label={t("settings.system.language")}
                  />
                )}
              />
            </SettingsField>

            <SettingsField label={t("settings.system.dateFormat")} error={errors.date_format?.message}>
              <SettingsSelect {...register("date_format")}>
                {DATE_FORMATS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard title={t("settings.system.filtersCard")}>
          <Controller
            control={control}
            name="save_filters"
            render={({ field }) => (
              <SettingsToggle
                checked={field.value}
                onChange={field.onChange}
                label={t("settings.system.saveFilters")}
                description={t("settings.system.saveFiltersDesc")}
              />
            )}
          />
        </SettingsCard>

        <SettingsCard title={t("settings.system.templatesCard")}>
          <SettingsField
            label={t("settings.system.journalTemplate")}
            hint={t("settings.system.journalTemplateHint")}
            error={errors.journal_template?.message}
          >
            <SettingsTextarea
              {...register("journal_template")}
              rows={5}
              placeholder={t("settings.system.journalTemplatePlaceholder")}
            />
          </SettingsField>
        </SettingsCard>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {errorMsg && <p className="mr-auto text-xs text-destructive">{errorMsg}</p>}
          {saveState === "saved" && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mr-auto inline-flex items-center gap-1.5 text-xs text-primary"
            >
              <Check className="h-3.5 w-3.5" />
              {t("common.saved")}
            </motion.p>
          )}
          <Button type="button" variant="ghost" disabled={!isDirty || saveState === "saving"} onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={saveState === "saving" || !isDirty} className="min-w-[120px]">
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              t("common.save")
            )}
          </Button>
        </div>
      </form>
    </SettingsShell>
  );
}
