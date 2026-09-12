"use client";

import clsx from "clsx";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { isBrokerAccount } from "@/lib/accounts/accountForm";
import { fmtMoney } from "@/lib/format";
import type { Account } from "@/lib/types";

interface AccountsStepProps {
  accounts: Account[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelectAccount: (account: Account) => void;
  onSyncAccount: (account: Account) => void;
  onAddNewAccount: () => void;
}

export function AccountsStep({
  accounts,
  isLoading,
  isError,
  onRetry,
  onSelectAccount,
  onSyncAccount,
  onAddNewAccount,
}: AccountsStepProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            My trading accounts
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Choose an account to add trades to, or connect a new one.
          </p>
        </div>
        <Button type="button" onClick={onAddNewAccount} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add new account
        </Button>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Active accounts</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 justify-center px-4 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts…
          </div>
        ) : isError ? (
          <div className="px-4 py-12 text-center text-sm text-destructive">
            Failed to load accounts.{" "}
            <button type="button" className="underline" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No accounts yet</p>
            <p className="mt-1 text-sm text-muted">Create a portfolio to start journaling trades.</p>
            <Button type="button" className="mt-4" onClick={onAddNewAccount}>
              <Plus className="h-4 w-4" />
              Add new account
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Currency</th>
                  <th className="px-4 py-3 font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">Trades</th>
                  <th className="px-4 py-3 font-medium">P&amp;L mode</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-border/70 transition hover:bg-foreground/[0.03]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{account.name}</span>
                        {account.is_default ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            Default
                          </span>
                        ) : null}
                        {isBrokerAccount(account) ? (
                          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                            {account.broker_name || "Broker"}
                          </span>
                        ) : null}
                      </div>
                      {account.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted">{account.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-muted">{account.base_currency}</td>
                    <td className="px-4 py-3.5 font-mono text-foreground">
                      {fmtMoney(Number(account.initial_balance), { signed: false })}
                    </td>
                    <td className="px-4 py-3.5 text-muted">{account.trade_count}</td>
                    <td className="px-4 py-3.5 capitalize text-muted">{account.pnl_display_mode}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {isBrokerAccount(account) ? (
                          <button
                            type="button"
                            onClick={() => onSyncAccount(account)}
                            title="Sync trades from broker"
                            aria-label={`Sync trades from ${account.broker_name || account.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary transition hover:bg-primary/10"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onSelectAccount(account)}
                          className={clsx(
                            "text-sm font-medium text-primary underline-offset-2 hover:underline"
                          )}
                        >
                          Add trades
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Manage portfolios in{" "}
        <Link href="/settings/accounts" className="text-primary underline-offset-2 hover:underline">
          Settings → Accounts
        </Link>
      </p>
    </div>
  );
}
