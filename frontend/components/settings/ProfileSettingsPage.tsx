"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Check, Loader2, Link2, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/providers/AuthProvider";
import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsShell,
  SettingsTextarea,
  SettingsToggle,
} from "@/components/settings/SettingsShell";
import { AvatarUploader } from "@/components/settings/AvatarUploader";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { firstName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

const optionalUrl = z
  .string()
  .max(512)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), "Must be a valid http(s) URL");

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  username: z
    .string()
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]*$/, "Only letters, numbers, _ . -")
    .optional()
    .or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(255).optional().or(z.literal("")),
  website_url: optionalUrl,
  twitter_url: optionalUrl,
  linkedin_url: optionalUrl,
  public_profile: z.boolean(),
  show_financial_metrics: z.boolean(),
  show_latest_trades: z.boolean(),
  show_pnl_chart: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(6, "min 6 characters").max(128),
    confirm_password: z.string().min(6, "min 6 characters").max(128),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: "Must be different from current password",
    path: ["new_password"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function ProfileSettingsPage() {
  const { user, loading, updateProfile, changePassword } = useAuth();
  const toast = useToast();

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaults = useMemo<ProfileFormValues>(
    () => ({
      name: user?.name || "",
      username: user?.username || "",
      bio: user?.bio || "",
      location: user?.location || "",
      website_url: user?.website_url || "",
      twitter_url: user?.twitter_url || "",
      linkedin_url: user?.linkedin_url || "",
      public_profile: user?.public_profile ?? false,
      show_financial_metrics: user?.show_financial_metrics ?? true,
      show_latest_trades: user?.show_latest_trades ?? true,
      show_pnl_chart: user?.show_pnl_chart ?? true,
    }),
    [user]
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isDirty: passwordDirty, isSubmitting: passwordSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      await updateProfile({
        name: values.name.trim(),
        username: values.username?.trim() || null,
        bio: values.bio?.trim() || null,
        location: values.location?.trim() || null,
        website_url: values.website_url?.trim() || null,
        twitter_url: values.twitter_url?.trim() || null,
        linkedin_url: values.linkedin_url?.trim() || null,
        public_profile: values.public_profile,
        show_financial_metrics: values.show_financial_metrics,
        show_latest_trades: values.show_latest_trades,
        show_pnl_chart: values.show_pnl_chart,
      });
      setSaveState("saved");
      toast.success("Profile saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setErrorMsg(message);
      toast.error("Could not save profile", message);
    }
  });

  function handleCancel() {
    reset(defaults);
    setErrorMsg(null);
    setSaveState("idle");
  }

  const onPasswordSubmit = handlePasswordSubmit(async (values) => {
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      });
      resetPassword();
      toast.success("Password updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      toast.error("Could not update password", message);
    }
  });

  if (loading && !user) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-40 rounded bg-white/5" />
          <div className="h-4 w-72 rounded bg-white/[0.04]" />
          <div className="h-48 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
          <div className="h-32 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader
        title="Profile"
        subtitle="Manage your personal information and account details."
      />

      <form onSubmit={onSubmit} className="space-y-5">
        <SettingsCard title="Personal" description="How you appear across TradeFix.">
          <AvatarUploader />

          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Full Name" error={errors.name?.message}>
              <SettingsInput {...register("name")} placeholder="Kalpesh Rajput" autoComplete="name" />
            </SettingsField>
            <SettingsField label="Email" hint="Email is managed by your login credentials.">
              <SettingsInput value={user?.email || ""} disabled className="opacity-60" />
            </SettingsField>
            <SettingsField
              label="Username"
              hint="Used for your public profile URL."
              error={errors.username?.message}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">
                  @
                </span>
                <SettingsInput {...register("username")} placeholder="your-username" className="pl-7" />
              </div>
            </SettingsField>
            <SettingsField label="Location" error={errors.location?.message}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <SettingsInput {...register("location")} placeholder="City, Country" className="pl-9" />
              </div>
            </SettingsField>
          </div>

          <div className="mt-4">
            <SettingsField label="Bio" error={errors.bio?.message}>
              <SettingsTextarea
                {...register("bio")}
                rows={4}
                placeholder="Short bio — trading style, markets, focus…"
              />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard title="Links" description="Optional social and web presence.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Website" error={errors.website_url?.message}>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <SettingsInput {...register("website_url")} placeholder="https://" className="pl-9" />
              </div>
            </SettingsField>
            <SettingsField label="Twitter / X" error={errors.twitter_url?.message}>
              <SettingsInput {...register("twitter_url")} placeholder="https://x.com/username" />
            </SettingsField>
            <SettingsField label="LinkedIn" error={errors.linkedin_url?.message}>
              <SettingsInput {...register("linkedin_url")} placeholder="https://linkedin.com/in/…" />
            </SettingsField>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Public Profile Settings"
          description="Control what others can see if you share your profile."
        >
          <div className="divide-y divide-white/[0.04]">
            <div className="py-3 first:pt-0 last:pb-0">
              <Controller
                control={control}
                name="public_profile"
                render={({ field }) => (
                  <SettingsToggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Share profile publicly"
                    description="Allow others to view your public profile"
                  />
                )}
              />
            </div>
            <div className="py-3">
              <Controller
                control={control}
                name="show_financial_metrics"
                render={({ field }) => (
                  <SettingsToggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Show financial metrics"
                    description="Display win rate, P&L, and related stats"
                  />
                )}
              />
            </div>
            <div className="py-3">
              <Controller
                control={control}
                name="show_latest_trades"
                render={({ field }) => (
                  <SettingsToggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Show latest trades"
                    description="List recent executions on your public page"
                  />
                )}
              />
            </div>
            <div className="py-3 last:pb-0">
              <Controller
                control={control}
                name="show_pnl_chart"
                render={({ field }) => (
                  <SettingsToggle
                    checked={field.value}
                    onChange={field.onChange}
                    label="Show P&L chart"
                    description="Include cumulative equity curve"
                  />
                )}
              />
            </div>
          </div>
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
              Profile saved
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

      <form onSubmit={onPasswordSubmit} className="mt-5 space-y-5" autoComplete="off">
        <SettingsCard title="Change Password" description="Update the password you use to sign in.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="Current Password" error={passwordErrors.current_password?.message}>
              <SettingsInput
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                {...registerPassword("current_password")}
              />
            </SettingsField>
            <div className="hidden sm:block" aria-hidden />
            <SettingsField
              label="New Password"
              hint="min 6 characters"
              error={passwordErrors.new_password?.message}
            >
              <SettingsInput
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...registerPassword("new_password")}
              />
            </SettingsField>
            <SettingsField label="Confirm Password" error={passwordErrors.confirm_password?.message}>
              <SettingsInput
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                {...registerPassword("confirm_password")}
              />
            </SettingsField>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              disabled={passwordSubmitting || !passwordDirty}
              className="min-w-[160px]"
            >
              {passwordSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </div>
        </SettingsCard>
      </form>
    </SettingsShell>
  );
}
