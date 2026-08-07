"use client";

import { Control, Controller, FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel } from "@/components/trade/ui";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40 disabled:opacity-40";

export function DateTimeFields({
  control,
  errors,
  watch,
}: {
  control: Control<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  watch: UseFormWatch<AddTradeFormValues>;
}) {
  const status = watch("status");

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <DateField control={control} name="entryDate" label="Entry Date" error={errors.entryDate?.message} />
        <TimeField control={control} name="entryTime" label="Entry Time" error={errors.entryTime?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateField
          control={control}
          name="exitDate"
          label="Exit Date"
          error={errors.exitDate?.message}
          disabled={status === "open"}
        />
        <TimeField
          control={control}
          name="exitTime"
          label="Exit Time"
          error={errors.exitTime?.message}
          disabled={status === "open"}
        />
      </div>
    </>
  );
}

function DateField({
  control,
  name,
  label,
  error,
  disabled,
}: {
  control: Control<AddTradeFormValues>;
  name: "entryDate" | "exitDate";
  label: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel error={error}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <input
            type="date"
            disabled={disabled}
            value={field.value ?? ""}
            onChange={field.onChange}
            className={inputClass}
          />
        )}
      />
    </div>
  );
}

function TimeField({
  control,
  name,
  label,
  error,
  disabled,
}: {
  control: Control<AddTradeFormValues>;
  name: "entryTime" | "exitTime";
  label: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel error={error}>{label}</FieldLabel>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <input
            type="time"
            disabled={disabled}
            value={field.value ?? ""}
            onChange={field.onChange}
            className={`${inputClass} [color-scheme:dark]`}
          />
        )}
      />
    </div>
  );
}

export function PriceInputs({
  register,
  errors,
  watch,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  watch: UseFormWatch<AddTradeFormValues>;
}) {
  const status = watch("status");
  const assetType = watch("asset_type");
  const showLeverage = assetType === "forex" || assetType === "crypto";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <NumField label="Entry" error={errors.entry_price?.message} placeholder="e.g. 168.50" {...register("entry_price")} />
        <NumField
          label="Exit"
          error={errors.exit_price?.message}
          placeholder="e.g. 168.50"
          disabled={status === "open"}
          {...register("exit_price")}
        />
        <NumField label="Qty" error={errors.quantity?.message} placeholder="Shares (e.g. 100)" {...register("quantity")} />
        <NumField label="Fees" error={errors.fees?.message} placeholder="0" {...register("fees")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Risk $"
          error={errors.risk_amount?.message}
          placeholder="e.g. 100"
          {...register("risk_amount")}
        />
        <NumField
          label="Plan 1–10"
          error={errors.plan_compliance?.message}
          placeholder="e.g. 8"
          min={1}
          max={10}
          {...register("plan_compliance")}
        />
      </div>
      {showLeverage && (
        <div className="grid grid-cols-4 gap-3">
          <NumField
            label="Leverage"
            error={errors.leverage?.message}
            placeholder="e.g. 50"
            {...register("leverage")}
          />
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  error,
  disabled,
  ...props
}: {
  label: string;
  error?: string;
  disabled?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <FieldLabel error={error}>{label}</FieldLabel>
      <input
        type="number"
        step="any"
        disabled={disabled}
        className={`${inputClass} font-mono ${error ? "border-destructive/50" : ""}`}
        {...props}
      />
    </div>
  );
}
