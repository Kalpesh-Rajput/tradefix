"use client";

import { useMemo } from "react";
import { Control, useWatch } from "react-hook-form";

import { AddTradeFormValues, defaultAddTradeValues, liveTradeCalc } from "@/components/trade/schema";

const CALC_FIELDS = [
  "asset_type",
  "symbol",
  "side",
  "quantity",
  "entry_price",
  "fees",
  "stop_loss",
  "risk_amount",
  "leverage",
  "contract_size",
  "tick_size",
  "tick_value",
  "entryDate",
  "entryTime",
  "exits",
] as const;

export function useLiveTradeCalc(control: Control<AddTradeFormValues>) {
  const watched = useWatch({ control, name: [...CALC_FIELDS] });
  const key = JSON.stringify(watched ?? []);
  return useMemo(() => {
    const parsed = JSON.parse(key) as unknown;
    if (!Array.isArray(parsed) || parsed.length < CALC_FIELDS.length) {
      const empty = liveTradeCalc(defaultAddTradeValues());
      return { calc: empty, assetType: "stock" as const, side: "long" as const, leverage: null };
    }
    const [
      asset_type,
      symbol,
      side,
      quantity,
      entry_price,
      fees,
      stop_loss,
      risk_amount,
      leverage,
      contract_size,
      tick_size,
      tick_value,
      entryDate,
      entryTime,
      exits,
    ] = JSON.parse(key) as [
      AddTradeFormValues["asset_type"],
      string,
      AddTradeFormValues["side"],
      AddTradeFormValues["quantity"],
      AddTradeFormValues["entry_price"],
      AddTradeFormValues["fees"],
      AddTradeFormValues["stop_loss"],
      AddTradeFormValues["risk_amount"],
      AddTradeFormValues["leverage"],
      AddTradeFormValues["contract_size"],
      AddTradeFormValues["tick_size"],
      AddTradeFormValues["tick_value"],
      string,
      string,
      AddTradeFormValues["exits"],
    ];
    const calc = liveTradeCalc({
      ...defaultAddTradeValues(),
      asset_type,
      symbol: symbol || "",
      side,
      quantity,
      entry_price,
      fees,
      stop_loss,
      risk_amount,
      leverage,
      contract_size,
      tick_size,
      tick_value,
      entryDate,
      entryTime,
      exits: exits ?? [],
    });
    return { calc, assetType: asset_type, side, leverage };
  }, [key]);
}
