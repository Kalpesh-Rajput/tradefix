"use client";

import { Control, Controller, FieldErrors, UseFormRegister, UseFormSetValue, useWatch } from "react-hook-form";

import { DateField } from "@/components/trade/DateTimePicker";
import { FeeField } from "@/components/trade/FeeField";
import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, FieldSlot, NumField, Readout, SegmentedControl, formInputClass, tradeGridClass } from "@/components/trade/ui";
import { fmtMoney } from "@/lib/format";
import { LEVERAGE_OPTIONS } from "@/lib/instruments/catalog";
import { positionValue, type TradeCalcResult } from "@/lib/tradeCalc";

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

export function TradeSizeFields({
  register,
  control,
  setValue,
  errors,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  control: Control<AddTradeFormValues>;
  setValue: UseFormSetValue<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
}) {
  const asset = useWatch({ control, name: "asset_type" });
  const optionType = useWatch({ control, name: "option_type" }) || "";
  const symbol = useWatch({ control, name: "symbol" });
  const quantity = Number(useWatch({ control, name: "quantity" }) || 0);
  const entryPrice = Number(useWatch({ control, name: "entry_price" }) || 0);
  const contractSize = useWatch({ control, name: "contract_size" });
  const feeBasis = positionValue({
    assetType: asset,
    symbol: symbol || "",
    quantity,
    entryPrice,
    contractSize: Number(contractSize) > 0 ? Number(contractSize) : null,
  });

  const qtyLabel = asset === "forex" ? "Lots" : asset === "option" || asset === "future" ? "Contracts" : "Quantity";
  const priceLabel = asset === "option" ? "Premium" : "Entry price";
  const qtyPlaceholder = asset === "forex" ? "0.10" : asset === "crypto" ? "0.25" : "100";
  const pricePlaceholder = asset === "forex" ? "1.08500" : asset === "option" ? "2.40" : "168.50";

  return (
    <div className="space-y-3">
      {asset === "option" && (
        <div className={tradeGridClass}>
          <FieldSlot name="option_type">
            <FieldLabel error={errors.option_type?.message}>Call / Put</FieldLabel>
            <SegmentedControl<string>
              ariaLabel="Call / Put"
              layoutId="option-type-seg"
              value={optionType}
              onChange={(next) => setValue("option_type", next, { shouldValidate: true, shouldDirty: true })}
              options={[
                { value: "call", label: "Call" },
                { value: "put", label: "Put" },
              ]}
            />
          </FieldSlot>
          <FieldSlot name="strike_price">
            <NumField
              label="Strike price"
              error={errors.strike_price?.message}
              placeholder="180"
              {...register("strike_price")}
            />
          </FieldSlot>
          <FieldSlot name="expiry_date">
            <Controller
              control={control}
              name="expiry_date"
              render={({ field }) => (
                <DateField
                  label="Expiry date"
                  value={field.value || ""}
                  onChange={field.onChange}
                  error={errors.expiry_date?.message}
                />
              )}
            />
          </FieldSlot>
          <FieldSlot name="contract_size">
            <NumField
              label="Lot size"
              error={errors.contract_size?.message}
              placeholder="100"
              {...register("contract_size")}
            />
          </FieldSlot>
        </div>
      )}

      <div className={tradeGridClass}>
        <FieldSlot name="quantity">
          <NumField
            label={qtyLabel}
            error={errors.quantity?.message}
            placeholder={qtyPlaceholder}
            {...register("quantity")}
          />
        </FieldSlot>
        <FieldSlot name="entry_price">
          <NumField
            label={priceLabel}
            error={errors.entry_price?.message}
            placeholder={pricePlaceholder}
            {...register("entry_price")}
          />
        </FieldSlot>
        <FieldSlot name="stop_loss">
          <NumField label="Stop loss" error={errors.stop_loss?.message} placeholder="Optional" {...register("stop_loss")} />
        </FieldSlot>
        <FieldSlot name="fees">
          <Controller
            control={control}
            name="fees"
            render={({ field }) => (
              <FeeField
                label="Brokerage / Fees"
                amount={field.value}
                basis={feeBasis}
                basisLabel="position value"
                onChange={(next) => field.onChange(next)}
                error={errors.fees?.message}
              />
            )}
          />
        </FieldSlot>
      </div>

      {asset === "future" && (
        <div className={tradeGridClass}>
          <FieldSlot name="contract_size">
            <NumField
              label="Contract size"
              error={errors.contract_size?.message}
              placeholder="50"
              {...register("contract_size")}
            />
          </FieldSlot>
          <FieldSlot name="tick_size">
            <NumField label="Tick size" error={errors.tick_size?.message} placeholder="0.25" {...register("tick_size")} />
          </FieldSlot>
          <FieldSlot name="tick_value">
            <NumField label="Tick value" error={errors.tick_value?.message} placeholder="12.50" {...register("tick_value")} />
          </FieldSlot>
        </div>
      )}
    </div>
  );
}

export function LeverageField({
  register,
  errors,
  asset,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  asset: AddTradeFormValues["asset_type"];
}) {
  if (asset !== "forex" && asset !== "crypto") return null;
  return (
    <FieldSlot name="leverage">
      <FieldLabel error={errors.leverage?.message}>Leverage</FieldLabel>
      <select className={formInputClass(errors.leverage?.message)} {...register("leverage")}>
        {asset === "crypto" && <option value="">Spot / 1×</option>}
        {LEVERAGE_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n}×
          </option>
        ))}
      </select>
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
