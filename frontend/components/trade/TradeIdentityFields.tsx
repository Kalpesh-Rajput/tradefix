"use client";

import { Controller, UseFormReturn, useFormState, useWatch } from "react-hook-form";

import { AccountPicker } from "@/components/accounts/AccountPicker";
import { AssetSelector } from "@/components/trade/AssetSelector";
import { DateField } from "@/components/trade/DateTimePicker";
import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { LeverageField } from "@/components/trade/SegmentSpecificFields";
import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldSlot, PlainFieldLabel, tableNumClass } from "@/components/trade/ui";

const SYMBOL_PLACEHOLDER: Record<AddTradeFormValues["asset_type"], string> = {
  stock: "e.g. AAPL",
  option: "e.g. AAPL",
  future: "e.g. ES",
  forex: "e.g. EURUSD",
  crypto: "e.g. BTC",
};

export function TradeIdentityFields({
  form,
  accounts,
  symbolSuggestions,
  onSegmentChange,
}: {
  form: UseFormReturn<AddTradeFormValues>;
  accounts: { id: string; name: string }[];
  symbolSuggestions: string[];
  onSegmentChange: (next: AddTradeFormValues["asset_type"]) => void;
}) {
  const { control, register, setValue } = form;
  const { errors } = useFormState({ control });
  const assetType = useWatch({ control, name: "asset_type" });
  const accountId = useWatch({ control, name: "account_id" });
  const optionType = useWatch({ control, name: "option_type" }) || "";

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <FieldSlot name="account_id">
        <PlainFieldLabel>Account</PlainFieldLabel>
        <AccountPicker
          accounts={accounts}
          value={accountId || ""}
          onChange={(id) => setValue("account_id", id, { shouldDirty: true })}
          tone="trade"
          size="sm"
          placeholder="Select account"
        />
      </FieldSlot>
      <AssetSelector control={control} error={errors.asset_type?.message} onSegmentChange={onSegmentChange} presentation="dropdown" />
      <FieldSlot name="symbol">
        <PlainFieldLabel required error={errors.symbol?.message}>
          {assetType === "option" ? "Underlying" : "Symbol"}
        </PlainFieldLabel>
        <Controller
          control={control}
          name="symbol"
          render={({ field }) => (
            <MasterCombobox
              category="symbol"
              label={assetType === "option" ? "Underlying" : "Symbol"}
              value={field.value || ""}
              onChange={field.onChange}
              error={errors.symbol?.message}
              placeholder={SYMBOL_PLACEHOLDER[assetType]}
              uppercase
              compact
              hideLabel
              suggestions={symbolSuggestions}
            />
          )}
        />
      </FieldSlot>
      {assetType === "option" ? (
        <>
          <FieldSlot name="contract_size">
            <PlainFieldLabel error={errors.contract_size?.message}>Lot size</PlainFieldLabel>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="100"
              aria-label="Lot size"
              aria-invalid={errors.contract_size ? true : undefined}
              className={tableNumClass(errors.contract_size?.message)}
              {...register("contract_size")}
            />
          </FieldSlot>
          <FieldSlot name="expiry_date">
            <PlainFieldLabel required error={errors.expiry_date?.message}>
              Expiry date
            </PlainFieldLabel>
            <Controller
              control={control}
              name="expiry_date"
              render={({ field }) => (
                <DateField
                  label="Expiry date"
                  value={field.value || ""}
                  onChange={field.onChange}
                  error={errors.expiry_date?.message}
                  compact
                  hideLabel
                  placeholder="e.g. 2026/12/06"
                />
              )}
            />
          </FieldSlot>
          <FieldSlot name="strike_price">
            <PlainFieldLabel required error={errors.strike_price?.message}>
              Strike price
            </PlainFieldLabel>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="e.g. 200"
              aria-label="Strike price"
              aria-invalid={errors.strike_price ? true : undefined}
              className={tableNumClass(errors.strike_price?.message)}
              {...register("strike_price")}
            />
          </FieldSlot>
          <FieldSlot name="option_type">
            <PlainFieldLabel required error={errors.option_type?.message}>
              Call / Put
            </PlainFieldLabel>
            <div role="group" aria-label="Call / Put" className="flex h-9 gap-2">
              {(
                [
                  ["call", "Call"],
                  ["put", "Put"],
                ] as const
              ).map(([value, label]) => {
                const selected = optionType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setValue("option_type", value, { shouldValidate: true, shouldDirty: true })}
                    className={`h-9 min-w-[4.5rem] flex-1 rounded-lg border text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground text-on-accent"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </FieldSlot>
        </>
      ) : null}
      {assetType === "future" || assetType === "forex" ? (
        <FieldSlot name="contract_size">
          <PlainFieldLabel error={errors.contract_size?.message}>Contract size</PlainFieldLabel>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            placeholder={assetType === "forex" ? "100000" : "e.g. 50"}
            aria-label="Contract size"
            aria-invalid={errors.contract_size ? true : undefined}
            className={tableNumClass(errors.contract_size?.message)}
            {...register("contract_size")}
          />
        </FieldSlot>
      ) : null}
      {assetType === "future" ? (
        <>
          <FieldSlot name="tick_size">
            <PlainFieldLabel error={errors.tick_size?.message}>Tick size</PlainFieldLabel>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0.25"
              aria-label="Tick size"
              aria-invalid={errors.tick_size ? true : undefined}
              className={tableNumClass(errors.tick_size?.message)}
              {...register("tick_size")}
            />
          </FieldSlot>
          <FieldSlot name="tick_value">
            <PlainFieldLabel error={errors.tick_value?.message}>Tick value</PlainFieldLabel>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="12.50"
              aria-label="Tick value"
              aria-invalid={errors.tick_value ? true : undefined}
              className={tableNumClass(errors.tick_value?.message)}
              {...register("tick_value")}
            />
          </FieldSlot>
        </>
      ) : null}
      <LeverageField register={register} errors={errors} asset={assetType} compact />
      <FieldSlot name="session">
        <Controller
          control={control}
          name="session"
          render={({ field }) => (
            <div>
              <PlainFieldLabel>Session</PlainFieldLabel>
              <MasterCombobox
                category="session"
                label="Session"
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="Select session"
                compact
                hideLabel
              />
            </div>
          )}
        />
      </FieldSlot>
      <FieldSlot name="trade_type">
        <Controller
          control={control}
          name="trade_type"
          render={({ field }) => (
            <div>
              <PlainFieldLabel>Trade type</PlainFieldLabel>
              <MasterCombobox
                category="trade_type"
                label="Trade type"
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="Select trade type"
                compact
                hideLabel
              />
            </div>
          )}
        />
      </FieldSlot>
    </div>
  );
}
