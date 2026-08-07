"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAccounts } from "@/lib/hooks/useAccounts";
import type { Account, PnlDisplayMode } from "@/lib/types";

const ACTIVE_ACCOUNT_KEY = "tradefix_active_account_id";

type AccountContextValue = {
  accounts: Account[];
  defaultAccount: Account | null;
  activeAccount: Account | null;
  setActiveAccountId: (id: string) => void;
  loading: boolean;
  currency: string;
  currencySymbol: string;
  pnlDisplayMode: PnlDisplayMode;
  displayPnl: (pnl: number | null | undefined, fees?: number | null) => number | null;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF ",
  CNY: "¥",
  HKD: "HK$",
  SGD: "S$",
  NZD: "NZ$",
  KRW: "₩",
  BRL: "R$",
  MXN: "MX$",
  ZAR: "R",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  TRY: "₺",
  AED: "د.إ",
};

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

function readStoredAccountId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data: accounts = [], isLoading } = useAccounts();
  const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setActiveAccountIdState(readStoredAccountId());
    setHydrated(true);
  }, []);

  const defaultAccount = useMemo(
    () => accounts.find((a) => a.is_default) || accounts[0] || null,
    [accounts]
  );

  const activeAccount = useMemo(() => {
    if (!accounts.length) return null;
    if (activeAccountId) {
      const match = accounts.find((a) => a.id === activeAccountId);
      if (match) return match;
    }
    return defaultAccount;
  }, [accounts, activeAccountId, defaultAccount]);

  // If stored id was deleted / invalid, snap to default and persist
  useEffect(() => {
    if (!hydrated || isLoading || !accounts.length || !activeAccount) return;
    if (activeAccountId !== activeAccount.id) {
      setActiveAccountIdState(activeAccount.id);
      try {
        window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeAccount.id);
      } catch {
        // ignore
      }
    }
  }, [hydrated, isLoading, accounts, activeAccount, activeAccountId]);

  const setActiveAccountId = useCallback((id: string) => {
    setActiveAccountIdState(id);
    try {
      window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const currency = activeAccount?.base_currency || "USD";
  const currencySymbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  const pnlDisplayMode: PnlDisplayMode = activeAccount?.pnl_display_mode || "net";

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      defaultAccount,
      activeAccount,
      setActiveAccountId,
      loading: isLoading || !hydrated,
      currency,
      currencySymbol,
      pnlDisplayMode,
      displayPnl: (pnl, fees = 0) => {
        if (pnl == null) return null;
        if (pnlDisplayMode === "gross") return Number((pnl + Number(fees || 0)).toFixed(2));
        return pnl;
      },
      formatMoney: (n, opts) => {
        const signed = opts?.signed ?? true;
        const digits = opts?.digits ?? 2;
        const abs = Math.abs(n).toLocaleString(undefined, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
        if (!signed) return `${currencySymbol}${abs}`;
        const sign = n > 0 ? "+" : n < 0 ? "-" : "";
        return `${sign}${currencySymbol}${abs}`;
      },
    }),
    [
      accounts,
      defaultAccount,
      activeAccount,
      setActiveAccountId,
      isLoading,
      hydrated,
      currency,
      currencySymbol,
      pnlDisplayMode,
    ]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccountPrefs() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccountPrefs must be used within AccountProvider");
  return ctx;
}
