"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Resolver, useForm } from "react-hook-form";
import { z } from "zod";

import {
  SettingsCard,
  SettingsField,
  SettingsInput,
  SettingsPageHeader,
  SettingsSelect,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  exportAccountTrades,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useSetDefaultAccount,
  useUpdateAccount,
} from "@/lib/hooks/useAccounts";
import type { Account, PnlDisplayMode } from "@/lib/types";

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "INR",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "HKD",
  "SGD",
  "NZD",
  "KRW",
  "BRL",
  "MXN",
  "ZAR",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "TRY",
  "AED",
] as const;

const accountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(255),
  description: z.string().max(2000).optional().or(z.literal("")),
  initial_balance: z.coerce.number(),
  base_currency: z.enum(CURRENCIES),
  pnl_display_mode: z.enum(["net", "gross"]),
  default_fee_per_trade: z.coerce.number(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

function accountLabel(account: Account) {
  return account.is_default ? `${account.name} (default)` : account.name;
}

function toFormValues(account: Account): AccountFormValues {
  return {
    name: account.name,
    description: account.description || "",
    initial_balance: Number(account.initial_balance),
    base_currency: (CURRENCIES as readonly string[]).includes(account.base_currency)
      ? (account.base_currency as (typeof CURRENCIES)[number])
      : "USD",
    pnl_display_mode: account.pnl_display_mode === "gross" ? "gross" : "net",
    default_fee_per_trade: Number(account.default_fee_per_trade),
  };
}

export function AccountsSettingsPage() {
  const toast = useToast();
  const { data: accounts = [], isLoading, isError, refetch } = useAccounts();
  const updateAccount = useUpdateAccount();
  const createAccount = useCreateAccount();
  const setDefaultAccount = useSetDefaultAccount();
  const deleteAccount = useDeleteAccount();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exporting, setExporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!accounts.length) return null;
    return accounts.find((a) => a.id === selectedId) || accounts.find((a) => a.is_default) || accounts[0];
  }, [accounts, selectedId]);

  const defaults = useMemo(
    () => (selected ? toFormValues(selected) : null),
    [selected]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema) as Resolver<AccountFormValues>,
    values: defaults || undefined,
  });

  useEffect(() => {
    if (selected && !selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (defaults) reset(defaults);
  }, [defaults, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!selected) return;
    setSaveState("saving");
    setErrorMsg(null);
    try {
      await updateAccount.mutateAsync({
        id: selected.id,
        data: {
          name: values.name.trim(),
          description: values.description?.trim() || null,
          initial_balance: values.initial_balance,
          base_currency: values.base_currency,
          pnl_display_mode: values.pnl_display_mode as PnlDisplayMode,
          default_fee_per_trade: values.default_fee_per_trade,
        },
      });
      setSaveState("saved");
      toast.success("Account saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save account";
      setErrorMsg(message);
      toast.error("Could not save account", message);
    }
  });

  async function handleCreatePortfolio() {
    setCreating(true);
    try {
      const created = await createAccount.mutateAsync({
        name: `Portfolio ${accounts.length + 1}`,
        base_currency: "USD",
        initial_balance: 10000,
        pnl_display_mode: "net",
        default_fee_per_trade: 0,
        is_default: false,
      });
      setSelectedId(created.id);
      toast.success("Portfolio created");
    } catch (err) {
      toast.error("Could not create portfolio", err instanceof Error ? err.message : undefined);
    } finally {
      setCreating(false);
    }
  }

  async function handleSetDefault() {
    if (!selected || selected.is_default) return;
    try {
      await setDefaultAccount.mutateAsync(selected.id);
      toast.success("Default account updated");
    } catch (err) {
      toast.error("Could not set default", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleDeletePortfolio() {
    if (!selected) return;
    if (accounts.length <= 1) {
      toast.error("Cannot delete your only portfolio");
      return;
    }
    const confirmed = window.confirm(
      `Delete “${selected.name}”? All trades in this portfolio will be removed. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const deletedId = selected.id;
      await deleteAccount.mutateAsync(deletedId);
      const remaining = accounts.filter((a) => a.id !== deletedId);
      const next = remaining.find((a) => a.is_default) || remaining[0] || null;
      setSelectedId(next?.id ?? null);
      toast.success("Portfolio deleted");
    } catch (err) {
      toast.error("Could not delete portfolio", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    if (!selected) return;
    setExporting(true);
    try {
      await exportAccountTrades(selected.id, selected.name);
      toast.success("Trade history exported");
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <SettingsShell>
        <div className="animate-pulse space-y-5">
          <div className="h-8 w-40 rounded bg-white/5" />
          <div className="h-4 w-72 rounded bg-white/[0.04]" />
          <div className="h-16 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
          <div className="h-64 rounded-xl border border-white/[0.06] bg-zinc-950/80" />
        </div>
      </SettingsShell>
    );
  }

  if (isError) {
    return (
      <SettingsShell>
        <SettingsPageHeader title="Accounts" subtitle="Manage portfolios used for journaling and P&L." />
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          Failed to load accounts.{" "}
          <button type="button" className="underline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </SettingsShell>
    );
  }

  if (!selected) {
    return (
      <SettingsShell>
        <SettingsPageHeader title="Accounts" subtitle="Manage portfolios used for journaling and P&L." />
        <SettingsCard title="No portfolios yet">
          <Button onClick={handleCreatePortfolio} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Portfolio
          </Button>
        </SettingsCard>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell>
      <SettingsPageHeader title="Accounts" subtitle="Manage portfolios used for journaling and P&L." />

      <form onSubmit={onSubmit} className="space-y-5">
        <SettingsCard title="Account to Edit">
          <SettingsField label="Account to Edit">
            <SettingsSelect
              value={selected.id}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setSaveState("idle");
                setErrorMsg(null);
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </SettingsSelect>
          </SettingsField>
        </SettingsCard>

        <SettingsCard title="Account Details">
          <div className="space-y-5">
            <SettingsField label="Account Name" error={errors.name?.message}>
              <SettingsInput {...register("name")} />
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
                  {CURRENCIES.map((c) => (
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
        </SettingsCard>

        <SettingsCard title="Portfolio Actions">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Trade History
            </Button>

            <Button type="submit" disabled={saveState === "saving" || !isDirty} className="min-w-[130px]">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>

            {selected.is_default ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Check className="h-3.5 w-3.5" />
                Default account
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSetDefault}
                disabled={setDefaultAccount.isPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {setDefaultAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Set as Default
              </button>
            )}
          </div>

          {errorMsg && <p className="mt-3 text-xs text-destructive">{errorMsg}</p>}
          {saveState === "saved" && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3.5 w-3.5" />
              Account saved
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-600">
            {selected.trade_count} trade{selected.trade_count === 1 ? "" : "s"} in this portfolio
          </p>
        </SettingsCard>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCreatePortfolio}
            disabled={creating}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
            Create Portfolio
          </button>

          <button
            type="button"
            onClick={handleDeletePortfolio}
            disabled={deleting || accounts.length <= 1}
            title={accounts.length <= 1 ? "You must keep at least one portfolio" : "Delete this portfolio"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-destructive px-4 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete Portfolio
          </button>
        </div>
      </form>
    </SettingsShell>
  );
}
