"use client";

import { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, NumField, Readout, formInputClass } from "@/components/trade/ui";
import { fmtMoney } from "@/lib/format";
import { LEVERAGE_OPTIONS } from "@/lib/instruments/catalog";
import type { TradeCalcResult } from "@/lib/tradeCalc";

export function SegmentSpecificFields({
  register,
  watch,
  setValue,
  errors,
  calc,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  watch: UseFormWatch<AddTradeFormValues>;
  setValue: UseFormSetValue<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  calc: TradeCalcResult;
}) {
  const asset = watch("asset_type");
  const side = watch("side");
  const optionType = watch("option_type") || "";
  const leverage = watch("leverage");

  const qtyLabel = asset === "forex" ? "Lots" : asset === "option" || asset === "future" ? "Contracts" : "Quantity";
  const priceLabel = asset === "option" ? "Premium" : "Entry price";
  const qtyPlaceholder = asset === "forex" ? "0.10" : asset === "crypto" ? "0.25" : "100";
  const pricePlaceholder = asset === "forex" ? "1.08500" : asset === "option" ? "2.40" : "168.50";

  const capitalLabel =
    asset === "option" && side === "short"
      ? "Premium received"
      : asset === "forex" || (asset === "crypto" && Number(leverage) > 1) || asset === "future"
        ? "Margin used"
        : "Invested";
  const capitalValue =
    asset === "option" && side === "short"
      ? fmtMoney(calc.premiumReceived ?? calc.positionValue, { signed: false })
      : asset === "forex" || asset === "crypto" || asset === "future"
        ? calc.marginUsed != null
          ? fmtMoney(calc.marginUsed, { signed: false })
          : "—"
        : fmtMoney(calc.investedAmount, { signed: false });

  return (
    <div className="space-y-3">
      {asset === "option" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <FieldLabel error={errors.option_type?.message}>Call / Put</FieldLabel>
            <div className="flex gap-2">
              {(["call", "put"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValue("option_type", opt, { shouldValidate: true })}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs ${
                    optionType === opt
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/10 text-zinc-400"
                  }`}
                >
                  {opt === "call" ? "Call" : "Put"}
                </button>
              ))}
            </div>
          </div>
          <NumField
            label="Strike price"
            error={errors.strike_price?.message}
            placeholder="180"
            {...register("strike_price")}
          />
          <div>
            <FieldLabel error={errors.expiry_date?.message}>Expiry date</FieldLabel>
            <input type="date" className={formInputClass(errors.expiry_date?.message)} {...register("expiry_date")} />
          </div>
          <NumField
            label="Lot size"
            error={errors.contract_size?.message}
            placeholder="100"
            {...register("contract_size")}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumField
          label={qtyLabel}
          error={errors.quantity?.message}
          placeholder={qtyPlaceholder}
          {...register("quantity")}
        />
        <NumField
          label={priceLabel}
          error={errors.entry_price?.message}
          placeholder={pricePlaceholder}
          {...register("entry_price")}
        />
        <NumField label="Stop loss" error={errors.stop_loss?.message} placeholder="Optional" {...register("stop_loss")} />
        <NumField label="Brokerage / Fees" error={errors.fees?.message} placeholder="0" {...register("fees")} />
      </div>

      {asset === "future" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField
            label="Contract size"
            error={errors.contract_size?.message}
            placeholder="50"
            {...register("contract_size")}
          />
          <NumField label="Tick size" error={errors.tick_size?.message} placeholder="0.25" {...register("tick_size")} />
          <NumField label="Tick value" error={errors.tick_value?.message} placeholder="12.50" {...register("tick_value")} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(asset === "forex" || asset === "crypto") && (
          <div>
            <FieldLabel error={errors.leverage?.message}>Leverage</FieldLabel>
            <select className={formInputClass(errors.leverage?.message)} {...register("leverage")}>
              {asset === "crypto" && <option value="">Spot / 1×</option>}
              {LEVERAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </div>
        )}
        {(asset === "forex" || asset === "crypto" || asset === "future") && (
          <Readout label="Position value" value={fmtMoney(calc.positionValue, { signed: false })} />
        )}
        <Readout label={capitalLabel} value={capitalValue} />
        <Readout label="Risk $" value={calc.riskAmount != null ? fmtMoney(calc.riskAmount, { signed: false }) : "—"} />
        <NumField
          label="Plan 1–10"
          error={errors.plan_compliance?.message}
          placeholder="8"
          min={1}
          max={10}
          {...register("plan_compliance")}
        />
      </div>
    </div>
  );
}
