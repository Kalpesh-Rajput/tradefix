"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccountsStep } from "@/components/add-trades/AccountsStep";
import { AddAccountChoice } from "@/components/add-trades/AddAccountChoice";
import { BrokerSelectStep } from "@/components/add-trades/BrokerSelectStep";
import {
  ImportMethodStep,
  type ImportMethod,
} from "@/components/add-trades/ImportMethodStep";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { useToast } from "@/components/ui/Toast";
import { buildUnifiedBrokerCatalog, type UnifiedBroker } from "@/lib/brokers/unified-catalog";
import { useAccounts, useCreateAccount } from "@/lib/hooks/useAccounts";
import { useBrokerCatalog } from "@/lib/hooks/useBroker";
import type { Account } from "@/lib/types";

type FlowStep = "accounts" | "choose-account-type" | "broker" | "method";
type AccountMode = "existing" | "new-connect" | "demo";

function progressForStep(step: FlowStep): number {
  if (step === "accounts" || step === "choose-account-type") return 0.2;
  if (step === "broker") return 0.55;
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
  const [creatingDemo, setCreatingDemo] = useState(false);

  const unifiedBrokers = useMemo(
    () => buildUnifiedBrokerCatalog(catalogQuery.data?.brokers ?? []),
    [catalogQuery.data?.brokers]
  );

  const resetLocal = useCallback(() => {
    setStep("accounts");
    setAccountMode("existing");
    setTargetAccountId(null);
    setSelectedBroker(null);
    setCreatingDemo(false);
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
    if (step === "method") {
      if (accountMode === "demo") {
        setStep("choose-account-type");
        setSelectedBroker(null);
        return;
      }
      setStep("broker");
      return;
    }
    if (step === "broker") {
      if (accountMode === "existing") {
        setStep("accounts");
        setSelectedBroker(null);
        return;
      }
      setStep("choose-account-type");
      setSelectedBroker(null);
      return;
    }
    if (step === "choose-account-type") {
      setStep("accounts");
      setAccountMode("existing");
      return;
    }
  }

  function onSelectExistingAccount(account: Account) {
    setTargetAccountId(account.id);
    setActiveAccountId(account.id);
    setAccountMode("existing");
    setSelectedBroker(null);
    setStep("broker");
  }

  function onAddNewAccount() {
    setTargetAccountId(null);
    setSelectedBroker(null);
    setAccountMode("new-connect");
    setStep("choose-account-type");
  }

  function onConnectBrokerChoice() {
    setAccountMode("new-connect");
    setStep("broker");
  }

  async function onCreateDemo() {
    setCreatingDemo(true);
    try {
      const created = await createAccount.mutateAsync({
        name: "Demo Account",
        base_currency: "USD",
        initial_balance: 10000,
        pnl_display_mode: "net",
        default_fee_per_trade: 0,
        is_default: false,
      });
      setTargetAccountId(created.id);
      setActiveAccountId(created.id);
      setAccountMode("demo");
      setSelectedBroker(null);
      setStep("method");
      toast.success("Demo account created");
    } catch (err) {
      toast.error(
        "Could not create demo account",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setCreatingDemo(false);
    }
  }

  async function ensureTargetAccount(): Promise<string | null> {
    if (targetAccountId) return targetAccountId;
    if (accountMode !== "new-connect") return null;
    const name = selectedBroker?.name ? `${selectedBroker.name} Account` : `Portfolio ${accounts.length + 1}`;
    try {
      const created = await createAccount.mutateAsync({
        name,
        base_currency: "USD",
        initial_balance: 10000,
        pnl_display_mode: "net",
        default_fee_per_trade: 0,
        is_default: false,
      });
      setTargetAccountId(created.id);
      setActiveAccountId(created.id);
      return created.id;
    } catch (err) {
      toast.error(
        "Could not create account",
        err instanceof Error ? err.message : undefined
      );
      return null;
    }
  }

  async function onMethodContinue(method: ImportMethod) {
    const accountId = await ensureTargetAccount();
    if (accountMode === "new-connect" && !accountId) return;
    if (accountId) setActiveAccountId(accountId);

    const brokerIdForSync =
      selectedBroker?.connectors?.id ??
      (selectedBroker?.autoSyncAvailable ? selectedBroker.id : null);

    closeFlow();
    resetLocal();

    if (method === "auto-sync") {
      openModal("broker", { initialBrokerId: brokerIdForSync });
      return;
    }
    if (method === "file") {
      openModal("csv");
      return;
    }
    openModal("manual");
  }

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
                  onAddNewAccount={onAddNewAccount}
                />
              ) : null}

              {step === "choose-account-type" ? (
                <AddAccountChoice
                  creatingDemo={creatingDemo}
                  onConnectBroker={onConnectBrokerChoice}
                  onCreateDemo={onCreateDemo}
                  onBack={handleBack}
                />
              ) : null}

              {step === "broker" ? (
                <BrokerSelectStep
                  brokers={unifiedBrokers}
                  selected={selectedBroker}
                  onSelect={setSelectedBroker}
                  onContinue={() => setStep("method")}
                  catalogLoading={catalogQuery.isLoading}
                />
              ) : null}

              {step === "method" ? (
                <ImportMethodStep
                  broker={selectedBroker}
                  isDemo={accountMode === "demo"}
                  onContinue={onMethodContinue}
                />
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
