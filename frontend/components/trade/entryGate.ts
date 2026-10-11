import type { FieldPath } from "react-hook-form";

import type { AddTradeFormValues } from "@/components/trade/schema";

export type EntryGateIssue = {
  path: FieldPath<AddTradeFormValues>;
  message: string;
};

function blank(value: unknown) {
  return value == null || String(value).trim() === "";
}

function missingPositive(value: unknown) {
  if (blank(value)) return true;
  const n = typeof value === "number" ? value : Number(value);
  return !Number.isFinite(n) || n <= 0;
}

function missingFee(value: unknown) {
  if (blank(value)) return true;
  const n = typeof value === "number" ? value : Number(value);
  return !Number.isFinite(n) || n < 0;
}

function qtyMessage(asset: AddTradeFormValues["asset_type"], exit = false) {
  if (asset === "forex") return exit ? "Exit lots must be > 0" : "Lots must be > 0";
  if (asset === "option" || asset === "future") return exit ? "Exit contracts must be > 0" : "Contracts must be > 0";
  return exit ? "Exit quantity must be > 0" : "Quantity must be > 0";
}

function priceMessage(asset: AddTradeFormValues["asset_type"], exit = false) {
  if (exit) return "Exit price must be > 0";
  return asset === "option" ? "Premium must be > 0" : "Entry price must be > 0";
}

/** Fields above Add Execution that still need a value. */
export function entryGateIssues(values: AddTradeFormValues): EntryGateIssue[] {
  const issues: EntryGateIssue[] = [];
  const asset = values.asset_type;

  if (blank(values.account_id)) issues.push({ path: "account_id", message: "Select an account" });
  if (blank(values.symbol)) issues.push({ path: "symbol", message: "Symbol is required" });

  if (asset === "option" || asset === "future" || asset === "forex") {
    if (missingPositive(values.contract_size)) {
      issues.push({
        path: "contract_size",
        message: asset === "option" ? "Lot size must be > 0" : "Contract size must be > 0",
      });
    }
  }
  if (asset === "option") {
    if (blank(values.expiry_date) && blank(values.expiry)) {
      issues.push({ path: "expiry_date", message: "Expiry date is required" });
    }
    if (missingPositive(values.strike_price)) issues.push({ path: "strike_price", message: "Strike must be > 0" });
    if (blank(values.option_type)) issues.push({ path: "option_type", message: "Call or Put is required" });
  }
  if (asset === "future") {
    if (missingPositive(values.tick_size)) issues.push({ path: "tick_size", message: "Tick size must be > 0" });
    if (missingPositive(values.tick_value)) issues.push({ path: "tick_value", message: "Tick value must be > 0" });
  }
  if (asset === "forex" && missingPositive(values.leverage)) {
    issues.push({ path: "leverage", message: "Select leverage" });
  }

  if (blank(values.session)) issues.push({ path: "session", message: "Select a session" });
  if (blank(values.trade_type)) issues.push({ path: "trade_type", message: "Select a trade type" });
  if (blank(values.entryDate)) issues.push({ path: "entryDate", message: "Entry date required" });
  if (blank(values.entryTime)) issues.push({ path: "entryTime", message: "Entry time required" });
  if (missingPositive(values.quantity)) issues.push({ path: "quantity", message: qtyMessage(asset) });
  if (missingPositive(values.entry_price)) issues.push({ path: "entry_price", message: priceMessage(asset) });
  if (missingFee(values.fees)) issues.push({ path: "fees", message: "Fees cannot be empty" });

  (values.exits ?? []).forEach((leg, index) => {
    if (blank(leg.date)) issues.push({ path: `exits.${index}.date`, message: "Exit date required" });
    if (blank(leg.time)) issues.push({ path: `exits.${index}.time`, message: "Exit time required" });
    if (missingPositive(leg.quantity)) issues.push({ path: `exits.${index}.quantity`, message: qtyMessage(asset, true) });
    if (missingPositive(leg.price)) issues.push({ path: `exits.${index}.price`, message: priceMessage(asset, true) });
    if (missingFee(leg.fees)) issues.push({ path: `exits.${index}.fees`, message: "Fees cannot be empty" });
  });

  return issues;
}
