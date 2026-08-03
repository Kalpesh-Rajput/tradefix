"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/providers/AuthProvider";
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
import { getLanguageOptions } from "@/lib/languages";
import { getTimezoneOptions } from "@/lib/timezones";

const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;

const systemSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
  language: z.string().min(1, "Language is required"),
  date_format: z.enum(DATE_FORMATS),
  save_filters: z.boolean(),
  journal_template: z.string().max(10000).optional().or(z.literal("")),
});

type SystemFormValues = z.infer<typeof systemSchema>;

export function SystemSettingsPage() {
  const { user, loading, updateProfile } = useAuth();
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
      ? (user!.date_format as (typeof DATE_FORMATS)[number])
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

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

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
      setSaveState("saved");
      toast.success("System settings saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save settings";
      setErrorMsg(message);
      toast.error("Could not save settings", message);
    }
  });

  function handleCancel() {
    reset(defaults);
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
      <SettingsPageHeader
        title="System Settings"
        subtitle="Configure application preferences and defaults."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <SettingsCard title="Timezone" description="Used for calendars, journals, and daily briefings.">
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsField label="Timezone" error={errors.timezone?.message}>
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
                    searchPlaceholder="Search timezones…"
                    aria-label="Timezone"
                  />
                )}
              />
            </SettingsField>

            <SettingsField label="Language" error={errors.language?.message}>
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
                    searchPlaceholder="Search languages…"
                    aria-label="Language"
                  />
                )}
              />
            </SettingsField>

            <SettingsField label="Date Format" error={errors.date_format?.message}>
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

        <SettingsCard title="Filters">
          <Controller
            control={control}
            name="save_filters"
            render={({ field }) => (
              <SettingsToggle
                checked={field.value}
                onChange={field.onChange}
                label="Save Filters"
                description="Remember Trade Log filters between sessions"
              />
            )}
          />
        </SettingsCard>

        <SettingsCard title="Default Templates">
          <SettingsField
            label="Default Journal Template"
            hint="This template will be pre-filled when creating a new journal entry."
            error={errors.journal_template?.message}
          >
            <SettingsTextarea
              {...register("journal_template")}
              rows={5}
              placeholder={"What went well today?\nWhat can I improve?"}
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
              Settings saved
            </motion.p>
          )}
          <Button type="button" variant="ghost" disabled={!isDirty || saveState === "saving"} onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveState === "saving" || !isDirty} className="min-w-[120px]">
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </SettingsShell>
  );
}
