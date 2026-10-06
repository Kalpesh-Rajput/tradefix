"use client";

import { ChevronDown } from "lucide-react";
import { FieldErrors, UseFormRegister } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, FieldSlot, NumField, PlainFieldLabel, Readout, formInputClass, tableInputClass, tradeGridClass } from "@/components/trade/ui";
import { fmtMoney } from "@/lib/format";
import { LEVERAGE_OPTIONS } from "@/lib/instruments/catalog";
import { type TradeCalcResult } from "@/lib/tradeCalc";

export function capitalPresentation(
  asset: AddTradeFormValues["asset_type"],
  side: AddTradeFormValues["side"],
  leverage: AddTradeFormValues["leverage"],
  calc: TradeCalcResult
) {
  const label =
    asset === "option" && side === "short"
      ? "Premium received"
      : asset === "forex" || (asset === "crypto" && Number(leverage) > 1) || asset === "future"
        ? "Margin used"
        : "Invested";
  const value =
    asset === "option" && side === "short"
      ? fmtMoney(calc.premiumReceived ?? calc.positionValue, { signed: false })
      : asset === "forex" || asset === "crypto" || asset === "future"
        ? calc.marginUsed != null
          ? fmtMoney(calc.marginUsed, { signed: false })
          : "—"
        : fmtMoney(calc.investedAmount, { signed: false });
  return { label, value };
}

export function LeverageField({
  register,
  errors,
  asset,
  compact = false,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  asset: AddTradeFormValues["asset_type"];
  compact?: boolean;
}) {
  if (asset !== "forex" && asset !== "crypto") return null;
  return (
    <FieldSlot name="leverage">
      {compact ? (
        <PlainFieldLabel error={errors.leverage?.message}>Leverage</PlainFieldLabel>
      ) : (
        <FieldLabel error={errors.leverage?.message}>Leverage</FieldLabel>
      )}
      <div className="relative">
        <select
          aria-label="Leverage"
          className={`${compact ? tableInputClass(errors.leverage?.message) : formInputClass(errors.leverage?.message)} appearance-none pr-8`}
          {...register("leverage")}
        >
          {asset === "crypto" && <option value="">Spot / 1×</option>}
          {LEVERAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
      </div>
    </FieldSlot>
  );
}

export function RiskPlanFields({
  register,
  errors,
  asset,
  side,
  leverage,
  calc,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  asset: AddTradeFormValues["asset_type"];
  side: AddTradeFormValues["side"];
  leverage: AddTradeFormValues["leverage"];
  calc: TradeCalcResult;
}) {
  const capital = capitalPresentation(asset, side, leverage, calc);
  const showPosition = asset === "forex" || asset === "crypto" || asset === "future";
  return (
    <div className={tradeGridClass}>
      {showPosition && <Readout label="Position value" value={fmtMoney(calc.positionValue, { signed: false })} />}
      <Readout label={capital.label} value={capital.value} />
      <Readout label="Risk $" value={calc.riskAmount != null ? fmtMoney(calc.riskAmount, { signed: false }) : "—"} />
      <FieldSlot name="stop_loss">
        <NumField label="Stop loss" error={errors.stop_loss?.message} placeholder="Optional" {...register("stop_loss")} />
      </FieldSlot>
      <FieldSlot name="plan_compliance">
        <NumField
          label="Plan 1–10"
          error={errors.plan_compliance?.message}
          placeholder="8"
          min={1}
          max={10}
          {...register("plan_compliance")}
        />
      </FieldSlot>
    </div>
  );
}
