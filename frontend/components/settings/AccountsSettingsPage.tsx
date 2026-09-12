"use client";

import { Check, Download, Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AccountDetailsForm } from "@/components/accounts/AccountDetailsForm";
import { AccountPicker } from "@/components/accounts/AccountPicker";
import {
  SettingsCard,
  SettingsField,
  SettingsPageHeader,
  SettingsShell,
} from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  blankAccountValues,
  toAccountInput,
  toAccountUpdate,
  toFormValues,
  type AccountFormValues,
} from "@/lib/accounts/accountForm";
import {
  exportAccountTrades,
  useAccounts,
  useCreateAccount,
  useDeleteAccount,
  useSetDefaultAccount,
  useUpdateAccount,
} from "@/lib/hooks/useAccounts";
import type { Account } from "@/lib/types";

function accountLabel(account: Account) {
  return account.is_default ? `${account.name} (default)` : account.name;
}

export function AccountsSettingsPage() {
  const toast = useToast();
  const { data: accounts = [], isLoading, isError, refetch } = useAccounts();
  const updateAccount = useUpdateAccount();
  const createAccount = useCreateAccount();
  const setDefaultAccount = useSetDefaultAccount();
  const deleteAccount = useDeleteAccount();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit">("edit");
  const [createNonce, setCreateNonce] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (!accounts.length) return null;
    return accounts.find((a) => a.id === selectedId) || accounts.find((a) => a.is_default) || accounts[0];
  }, [accounts, selectedId]);

  const isCreate = formMode === "create";

  const createDefaults = useMemo(
    () =>
      blankAccountValues({
        name: accounts.length ? `Portfolio ${accounts.length + 1}` : "Portfolio 1",
      }),
    [accounts.length]
  );

  const formDefaults: AccountFormValues = isCreate
    ? createDefaults
    : selected
      ? toFormValues(selected)
      : createDefaults;

  const resetKey = isCreate ? `create-${createNonce}` : selected?.id ?? "create";

  useEffect(() => {
    if (selected && !selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!accounts.length) setFormMode("create");
  }, [accounts.length]);

  function startCreate() {
    setCreateNonce((n) => n + 1);
    setFormMode("create");
    setSaveState("idle");
    setErrorMsg(null);
  }

  function cancelCreate() {
    if (!selected) return;
    setFormMode("edit");
    setSaveState("idle");
    setErrorMsg(null);
  }

  async function handleFormSubmit(values: AccountFormValues) {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      if (isCreate) {
        const created = await createAccount.mutateAsync(toAccountInput(values));
        setSelectedId(created.id);
        setFormMode("edit");
        setSaveState("saved");
        toast.success("Account created");
      } else {
        if (!selected) return;
        await updateAccount.mutateAsync({
          id: selected.id,
          data: toAccountUpdate(values),
        });
        setSaveState("saved");
        toast.success("Account saved");
      }
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Failed to save account";
      setErrorMsg(message);
      toast.error(isCreate ? "Could not create account" : "Could not save account", message);
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
      setFormMode(next ? "edit" : "create");
      toast.success("Portfolio deleted");
    } catch (err) {
      toast.error("Could not delete portfolio", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    if (!selected) return;
    try {
      setExporting(true);
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

  return (
    <SettingsShell>
      <SettingsPageHeader title="Accounts" subtitle="Manage portfolios used for journaling and P&L." />

      <div className="space-y-5">
        {accounts.length > 0 ? (
          <SettingsCard title="Account to Edit">
            <SettingsField label="Account to Edit">
              <AccountPicker
                accounts={accounts}
                value={isCreate ? "__new__" : selected?.id ?? ""}
                getLabel={accountLabel}
                extraOptions={[{ id: "__new__", label: "Create new account…" }]}
                onChange={(id) => {
                  if (id === "__new__") {
                    startCreate();
                    return;
                  }
                  setSelectedId(id);
                  setFormMode("edit");
                  setSaveState("idle");
                  setErrorMsg(null);
                }}
              />
            </SettingsField>
          </SettingsCard>
        ) : null}

        <SettingsCard
          title={isCreate ? "New Account" : "Account Details"}
          description={
            isCreate
              ? "Fill in the details and save to create this portfolio. Canceling will not create an account."
              : undefined
          }
        >
          <AccountDetailsForm
            key={resetKey}
            mode={isCreate ? "create" : "edit"}
            defaultValues={formDefaults}
            resetKey={resetKey}
            submitLabel={isCreate ? "Save" : "Save Changes"}
            pending={saveState === "saving"}
            error={errorMsg}
            saved={saveState === "saved"}
            onSubmit={handleFormSubmit}
            onCancel={isCreate && selected ? cancelCreate : undefined}
            extraActions={
              !isCreate && selected ? (
                <>
                  <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export Trade History
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
                </>
              ) : null
            }
            footerNote={
              !isCreate && selected ? (
                <p className="text-xs text-zinc-600">
                  {selected.trade_count} trade{selected.trade_count === 1 ? "" : "s"} in this portfolio
                </p>
              ) : null
            }
          />
        </SettingsCard>

        {accounts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startCreate}
              disabled={isCreate}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary px-4 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Create Portfolio
            </button>

            <button
              type="button"
              onClick={handleDeletePortfolio}
              disabled={isCreate || deleting || !selected || accounts.length <= 1}
              title={accounts.length <= 1 ? "You must keep at least one portfolio" : "Delete this portfolio"}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-destructive px-4 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Portfolio
            </button>
          </div>
        ) : null}
      </div>
    </SettingsShell>
  );
}
