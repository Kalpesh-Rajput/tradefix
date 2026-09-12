"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Resolver, useForm } from "react-hook-form";

import {
  SettingsField,
  SettingsInput,
  SettingsSelect,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import {
  ACCOUNT_CURRENCIES,
  accountFormSchema,
  type AccountFormValues,
} from "@/lib/accounts/accountForm";

interface AccountDetailsFormProps {
  mode: "create" | "edit";
  defaultValues: AccountFormValues;
  resetKey: string;
  submitLabel: string;
  pending?: boolean;
  error?: string | null;
  saved?: boolean;
  onSubmit: (values: AccountFormValues) => Promise<void> | void;
  onCancel?: () => void;
  extraActions?: ReactNode;
  footerNote?: ReactNode;
}

export function AccountDetailsForm({
  mode,
  defaultValues,
  resetKey,
  submitLabel,
  pending = false,
  error,
  saved = false,
  onSubmit,
  onCancel,
  extraActions,
  footerNote,
}: AccountDetailsFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema) as Resolver<AccountFormValues>,
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
    // Only remount/reload when the caller changes resetKey (account or create session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, reset]);

  const saveDisabled = pending || (mode === "edit" && !isDirty);

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
      className="space-y-5"
    >
      <div className="space-y-5">
        <SettingsField label="Account Name" error={errors.name?.message}>
          <SettingsInput {...register("name")} autoComplete="off" />
        </SettingsField>

        <SettingsField label="Description" error={errors.description?.message}>
          <SettingsInput {...register("description")} placeholder="Optional description" />
        </SettingsField>

        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="Initial Balance" error={errors.initial_balance?.message}>
            <SettingsInput type="number" step="any" {...register("initial_balance")} />
          </SettingsField>

          <SettingsField label="Currency Symbol" error={errors.base_currency?.message}>
            <SettingsSelect {...register("base_currency")}>
              {ACCOUNT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SettingsSelect>
          </SettingsField>

          <SettingsField
            label="P&L Display Mode"
            hint="Synced across dashboard, calendar, and mobile"
            error={errors.pnl_display_mode?.message}
          >
            <SettingsSelect {...register("pnl_display_mode")}>
              <option value="net">Net profit after fees</option>
              <option value="gross">Gross profit before fees</option>
            </SettingsSelect>
          </SettingsField>

          <SettingsField label="Default Fee per Trade" error={errors.default_fee_per_trade?.message}>
            <SettingsInput type="number" step="any" {...register("default_fee_per_trade")} />
          </SettingsField>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {extraActions}
        <Button type="submit" disabled={saveDisabled} className="min-w-[130px]">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {saved ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-primary">
          <Check className="h-3.5 w-3.5" />
          Account saved
        </p>
      ) : null}
      {footerNote}
    </form>
  );
}
