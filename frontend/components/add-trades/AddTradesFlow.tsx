"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccountFormStep } from "@/components/add-trades/AccountFormStep";
import { AccountsStep } from "@/components/add-trades/AccountsStep";
import { AddAccountChoice } from "@/components/add-trades/AddAccountChoice";
import { BrokerSelectStep } from "@/components/add-trades/BrokerSelectStep";
import {
  ImportMethodStep,
  type ImportMethod,
} from "@/components/add-trades/ImportMethodStep";
import { BrokerConnectWizard } from "@/components/broker/BrokerConnectWizard";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { useToast } from "@/components/ui/Toast";
import {
  blankAccountValues,
  isBrokerAccount,
  accountInputFromBrokerConnect,
  toAccountInput,
  type AccountFormValues,
} from "@/lib/accounts/accountForm";
import { buildUnifiedBrokerCatalog, type UnifiedBroker } from "@/lib/brokers/unified-catalog";
import { resolveMt5ConnectServer } from "@/lib/brokers/mt5-servers";
import { useAccounts, useCreateAccount } from "@/lib/hooks/useAccounts";
import { useBrokerCatalog } from "@/lib/hooks/useBroker";
import type { ConnectResponse } from "@/lib/connectors/types";
import type { Account } from "@/lib/types";

type FlowStep = "accounts" | "choose-account-type" | "broker" | "method" | "account-form" | "connect";
type AccountMode = "existing" | "new-connect" | "dummy";

function progressForStep(step: FlowStep): number {
  if (step === "accounts" || step === "choose-account-type") return 0.2;
  if (step === "broker") return 0.45;
  if (step === "method") return 0.7;
  if (step === "connect") return 0.85;
  if (step === "account-form") return 0.9;
  return 0.85;
}

export function AddTradesFlow() {
  const toast = useToast();
  const { flowOpen, closeFlow, openModal } = useAddTradeModal();
  const { setActiveAccountId } = useAccountPrefs();
  const { data: accounts = [], isLoading, isError, refetch } = useAccounts();
  const createAccount = useCreateAccount();
  const catalogQuery = useBrokerCatalog();

  const [step, setStep] = useState<FlowStep>("accounts");
  const [accountMode, setAccountMode] = useState<AccountMode>("existing");
  const [targetAccountId, setTargetAccountId] = useState<string | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<UnifiedBroker | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [pendingMethod, setPendingMethod] = useState<ImportMethod | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const unifiedBrokers = useMemo(
    () => buildUnifiedBrokerCatalog(catalogQuery.data?.brokers ?? []),
    [catalogQuery.data?.brokers]
  );

  useEffect(() => {
    if (!selectedBroker) return;
    const next =
      unifiedBrokers.find((broker) => broker.id === selectedBroker.id) ??
      unifiedBrokers.find((broker) => broker.name === selectedBroker.name);
    if (!next) return;
    if (
      next.id !== selectedBroker.id ||
      next.autoSyncAvailable !== selectedBroker.autoSyncAvailable ||
      next.connectors?.id !== selectedBroker.connectors?.id ||
      next.servers.length !== selectedBroker.servers.length
    ) {
      setSelectedBroker(next);
    }
  }, [unifiedBrokers, selectedBroker]);

  const accountFormDefaults = useMemo(() => {
    if (accountMode === "dummy") {
      return blankAccountValues({ name: "Dummy Account" });
    }
    if (selectedServer) {
      return blankAccountValues({ name: `${selectedServer} Account` });
    }
    const name = selectedBroker?.name ? `${selectedBroker.name} Account` : "New Account";
    return blankAccountValues({ name });
  }, [accountMode, selectedBroker?.name, selectedServer]);

  const accountFormResetKey =
    accountMode === "dummy"
      ? "dummy"
      : `broker-${selectedBroker?.id ?? "none"}-${selectedServer ?? "none"}`;

  const resetLocal = useCallback(() => {
    setStep("accounts");
    setAccountMode("existing");
    setTargetAccountId(null);
    setSelectedBroker(null);
    setSelectedServer(null);
    setPendingMethod(null);
    setFormError(null);
  }, []);

  useEffect(() => {
    if (flowOpen) resetLocal();
  }, [flowOpen, resetLocal]);

  useEffect(() => {
    if (!flowOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeFlow();
        resetLocal();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flowOpen, closeFlow, resetLocal]);

  function handleClose() {
    closeFlow();
    resetLocal();
  }

  function handleBack() {
    if (step === "connect") {
      setStep("broker");
      return;
    }
    if (step === "account-form") {
      setFormError(null);
      if (accountMode === "dummy") {
        setStep("choose-account-type");
        return;
      }
      if (pendingMethod === "auto-sync" && accountMode === "new-connect") {
        setStep("broker");
        return;
      }
      setStep("method");
      return;
    }
    if (step === "method") {
      setPendingMethod(null);
      if (accountMode === "existing" || (accountMode === "dummy" && targetAccountId)) {
        setStep("accounts");
        setSelectedBroker(null);
        setSelectedServer(null);
        return;
      }
      if (accountMode === "dummy") {
        setStep("choose-account-type");
        setSelectedBroker(null);
        setSelectedServer(null);
        return;
      }
      setStep("broker");
      return;
    }
    if (step === "broker") {
      if (accountMode === "existing") {
        setStep("accounts");
        setSelectedBroker(null);
        setSelectedServer(null);
        return;
      }
      setStep("choose-account-type");
      setSelectedBroker(null);
      setSelectedServer(null);
      return;
    }
    if (step === "choose-account-type") {
      setStep("accounts");
      setAccountMode("existing");
    }
  }

  function brokerForAccount(account: Account): UnifiedBroker | null {
    if (!isBrokerAccount(account)) return null;
    return (
      unifiedBrokers.find((broker) => broker.id === account.broker_id) ||
      unifiedBrokers.find((broker) => broker.name === account.broker_name) ||
      null
    );
  }

  function onSelectExistingAccount(account: Account) {
    setTargetAccountId(account.id);
    setActiveAccountId(account.id);
    setAccountMode("existing");
    setPendingMethod(null);
    setSelectedBroker(brokerForAccount(account));
    setStep("method");
  }

  function onSyncAccount(account: Account) {
    const broker = brokerForAccount(account);
    const brokerIdForSync =
      broker?.connectors?.id ??
      (broker?.autoSyncAvailable ? broker.id : null) ??
      account.broker_id;
    setActiveAccountId(account.id);
    closeFlow();
    resetLocal();
    openModal("broker", {
      initialBrokerId: brokerIdForSync,
      initialAccountId: account.id,
    });
  }

  function onAddNewAccount() {
    setTargetAccountId(null);
    setSelectedBroker(null);
    setSelectedServer(null);
    setPendingMethod(null);
    setFormError(null);
    setAccountMode("new-connect");
    setStep("choose-account-type");
  }

  function onConnectBrokerChoice() {
    setAccountMode("new-connect");
    setPendingMethod(null);
    setFormError(null);
    setStep("broker");
  }

  function onChooseDummy() {
    setAccountMode("dummy");
    setSelectedBroker(null);
    setSelectedServer(null);
    setPendingMethod(null);
    setFormError(null);
    setStep("account-form");
  }

  async function onBrokerConnected(res: ConnectResponse) {
    const broker = selectedBroker;
    if (!broker) return;
    const login = String(res.account.account_number);
    const existing = accounts.find(
      (account) =>
        isBrokerAccount(account) &&
        (account.broker_id === broker.id || account.broker_id === broker.connectors?.id) &&
        account.name.includes(login)
    );
    if (existing) {
      setTargetAccountId(existing.id);
      setActiveAccountId(existing.id);
      return;
    }
    const created = await createAccount.mutateAsync(
      accountInputFromBrokerConnect({
        brokerId: broker.connectors?.id ?? broker.id,
        brokerName: broker.name,
        company: selectedServer,
        accountNumber: res.account.account_number,
        balance: res.account.balance,
        currency: res.account.currency,
      })
    );
    setTargetAccountId(created.id);
    setActiveAccountId(created.id);
  }

  function openTradeForMethod(method: ImportMethod, accountId: string, broker: UnifiedBroker | null) {
    setActiveAccountId(accountId);
    const tradeServer = resolveMt5ConnectServer(selectedServer) || selectedServer;
    const brokerIdForSync =
      broker?.connectors?.id ?? (broker?.autoSyncAvailable ? broker.id : null);

    closeFlow();
    resetLocal();

    if (method === "auto-sync") {
      openModal("broker", {
        initialBrokerId: brokerIdForSync,
        initialAccountId: accountId,
        initialServer: tradeServer,
      });
      return;
    }
    if (method === "file") {
      openModal("csv", { initialAccountId: accountId });
      return;
    }
    openModal("manual", { initialAccountId: accountId });
  }

  function onMethodContinue(method: ImportMethod) {
    if (accountMode === "new-connect") {
      setPendingMethod(method);
      setFormError(null);
      setStep("account-form");
      return;
    }
    if (targetAccountId) {
      openTradeForMethod(method, targetAccountId, selectedBroker);
    }
  }

  async function onAccountFormSave(values: AccountFormValues) {
    setFormError(null);
    try {
      const created = await createAccount.mutateAsync(
        toAccountInput(
          values,
          accountMode === "dummy"
            ? { source: "dummy" }
            : {
                source: "broker",
                broker_id: selectedBroker?.id ?? null,
                broker_name: selectedBroker?.name ?? null,
              }
        )
      );
      toast.success("Account created");
      if (accountMode === "dummy") {
        setTargetAccountId(created.id);
        setActiveAccountId(created.id);
        setStep("method");
        return;
      }
      const method = pendingMethod ?? "manual";
      openTradeForMethod(method, created.id, selectedBroker);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create account";
      setFormError(message);
      toast.error("Could not create account", message);
    }
  }

  const targetAccount = accounts.find((account) => account.id === targetAccountId);
  const methodIsDummy =
    accountMode === "dummy" || (accountMode === "existing" && (!targetAccount || !isBrokerAccount(targetAccount)));

  const showBack = step !== "accounts";
  const progress = progressForStep(step);

  return (
    <AnimatePresence>
      {flowOpen ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Add trades"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative flex h-[min(860px,100%)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
          >
            <div className="relative shrink-0 border-b border-border px-4 py-3 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                {showBack ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="w-9" />
                )}
                <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
              {step === "accounts" ? (
                <AccountsStep
                  accounts={accounts}
                  isLoading={isLoading}
                  isError={isError}
                  onRetry={() => refetch()}
                  onSelectAccount={onSelectExistingAccount}
                  onSyncAccount={onSyncAccount}
                  onAddNewAccount={onAddNewAccount}
                />
              ) : null}

              {step === "choose-account-type" ? (
                <AddAccountChoice
                  onConnectBroker={onConnectBrokerChoice}
                  onCreateDummy={onChooseDummy}
                  onBack={handleBack}
                />
              ) : null}

              {step === "broker" ? (
                <BrokerSelectStep
                  brokers={unifiedBrokers}
                  selected={selectedBroker}
                  selectedServer={selectedServer}
                  onSelect={(broker) => {
                    setSelectedBroker(broker);
                    setSelectedServer(null);
                  }}
                  onSelectServer={setSelectedServer}
                  onContinue={() => {
                    if (selectedBroker?.autoSyncAvailable) {
                      setPendingMethod("auto-sync");
                      setFormError(null);
                      setStep("connect");
                      return;
                    }
                    setStep("method");
                  }}
                  catalogLoading={catalogQuery.isLoading}
                />
              ) : null}

              {step === "method" ? (
                <ImportMethodStep
                  broker={selectedBroker}
                  isDemo={methodIsDummy}
                  onContinue={onMethodContinue}
                />
              ) : null}

              {step === "connect" ? (
                <BrokerConnectWizard
                  key={`${selectedBroker?.id ?? "mt5"}-${selectedServer ?? "none"}`}
                  compact
                  embedded
                  initialBrokerId={
                    selectedBroker?.connectors?.id ??
                    (selectedBroker?.autoSyncAvailable ? selectedBroker.id : null)
                  }
                  initialServer={resolveMt5ConnectServer(selectedServer) || selectedServer}
                  companyLabel={selectedServer}
                  onConnected={onBrokerConnected}
                />
              ) : null}

              {step === "account-form" ? (
                <AccountFormStep
                  title={accountMode === "dummy" ? "Dummy account" : "Confirm account"}
                  subtitle={
                    accountMode === "dummy"
                      ? "Save to create this portfolio. Closing or going back will discard it."
                      : "Review the account details and save to create it. Closing or going back will not create an account."
                  }
                  defaultValues={accountFormDefaults}
                  resetKey={accountFormResetKey}
                  pending={createAccount.isPending}
                  error={formError}
                  onSubmit={onAccountFormSave}
                />
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
