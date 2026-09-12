import { z } from "zod";

import type { Account, AccountInput, AccountSource, AccountUpdateInput, PnlDisplayMode } from "@/lib/types";

export const ACCOUNT_CURRENCIES = [
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

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(255),
  description: z.string().max(2000).optional().or(z.literal("")),
  initial_balance: z.coerce.number(),
  base_currency: z.enum(ACCOUNT_CURRENCIES),
  pnl_display_mode: z.enum(["net", "gross"]),
  default_fee_per_trade: z.coerce.number(),
});

export type AccountFormValues = z.infer<typeof accountFormSchema>;

export function blankAccountValues(
  overrides: Partial<AccountFormValues> = {}
): AccountFormValues {
  return {
    name: "",
    description: "",
    initial_balance: 10000,
    base_currency: "USD",
    pnl_display_mode: "net",
    default_fee_per_trade: 0,
    ...overrides,
  };
}

export function toFormValues(account: Account): AccountFormValues {
  return {
    name: account.name,
    description: account.description || "",
    initial_balance: Number(account.initial_balance),
    base_currency: (ACCOUNT_CURRENCIES as readonly string[]).includes(account.base_currency)
      ? (account.base_currency as (typeof ACCOUNT_CURRENCIES)[number])
      : "USD",
    pnl_display_mode: account.pnl_display_mode === "gross" ? "gross" : "net",
    default_fee_per_trade: Number(account.default_fee_per_trade),
  };
}

function mappedFields(values: AccountFormValues) {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || null,
    initial_balance: values.initial_balance,
    base_currency: values.base_currency,
    pnl_display_mode: values.pnl_display_mode as PnlDisplayMode,
    default_fee_per_trade: values.default_fee_per_trade,
  };
}

export function toAccountInput(
  values: AccountFormValues,
  extras: {
    is_default?: boolean;
    source?: AccountSource;
    broker_id?: string | null;
    broker_name?: string | null;
  } = {}
): AccountInput {
  const source = extras.source ?? "dummy";
  return {
    ...mappedFields(values),
    is_default: extras.is_default ?? false,
    source,
    broker_id: source === "broker" ? extras.broker_id ?? null : null,
    broker_name: source === "broker" ? extras.broker_name ?? null : null,
  };
}

export function isBrokerAccount(account: Pick<Account, "source">): boolean {
  return account.source === "broker";
}

function mapBrokerCurrency(currency: string): (typeof ACCOUNT_CURRENCIES)[number] {
  const cleaned = currency.trim().toUpperCase();
  return (ACCOUNT_CURRENCIES as readonly string[]).includes(cleaned)
    ? (cleaned as (typeof ACCOUNT_CURRENCIES)[number])
    : "USD";
}

/** Build a journal account from a live broker connect response. */
export function accountInputFromBrokerConnect(opts: {
  brokerId: string;
  brokerName: string;
  company?: string | null;
  accountNumber: number;
  balance: number;
  currency: string;
}): AccountInput {
  const label = opts.company?.trim() || opts.brokerName;
  return {
    name: `${label} ${opts.accountNumber}`.trim(),
    description: opts.company && opts.company !== opts.brokerName ? opts.company : null,
    initial_balance: opts.balance,
    base_currency: mapBrokerCurrency(opts.currency),
    pnl_display_mode: "net",
    default_fee_per_trade: 0,
    source: "broker",
    broker_id: opts.brokerId,
    broker_name: opts.brokerName,
  };
}

export function toAccountUpdate(values: AccountFormValues): AccountUpdateInput {
  return mappedFields(values);
}
