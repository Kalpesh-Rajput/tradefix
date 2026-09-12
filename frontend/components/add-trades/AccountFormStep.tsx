"use client";

import { AccountDetailsForm } from "@/components/accounts/AccountDetailsForm";
import type { AccountFormValues } from "@/lib/accounts/accountForm";

interface AccountFormStepProps {
  title: string;
  subtitle: string;
  defaultValues: AccountFormValues;
  resetKey: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: AccountFormValues) => Promise<void> | void;
}

export function AccountFormStep({
  title,
  subtitle,
  defaultValues,
  resetKey,
  pending,
  error,
  onSubmit,
}: AccountFormStepProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm text-muted">{subtitle}</p>
      <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
        <AccountDetailsForm
          key={resetKey}
          mode="create"
          defaultValues={defaultValues}
          resetKey={resetKey}
          submitLabel="Save"
          pending={pending}
          error={error}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
