"use client";

import { ChevronDown } from "lucide-react";
import { Control, Controller } from "react-hook-form";

import { ASSET_OPTIONS, AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, PlainFieldLabel, SegmentedControl, tableInputClass } from "@/components/trade/ui";

export function AssetSelector({
  control,
  error,
  onSegmentChange,
  presentation = "segmented",
}: {
  control: Control<AddTradeFormValues>;
  error?: string;
  onSegmentChange?: (next: AddTradeFormValues["asset_type"]) => void;
  presentation?: "segmented" | "dropdown";
}) {
  return (
    <div data-field="asset_type">
      {presentation === "dropdown" ? (
        <PlainFieldLabel error={error}>Select Segment</PlainFieldLabel>
      ) : (
        <FieldLabel error={error}>Select Segment</FieldLabel>
      )}
      <Controller
        control={control}
        name="asset_type"
        render={({ field }) =>
          presentation === "dropdown" ? (
            <div className="relative">
              <select
                aria-label="Select Segment"
                value={field.value}
                onChange={(event) => {
                  const next = event.target.value as AddTradeFormValues["asset_type"];
                  field.onChange(next);
                  onSegmentChange?.(next);
                }}
                className={`${tableInputClass(error)} appearance-none pr-8`}
              >
                {ASSET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            </div>
          ) : (
            <SegmentedControl
              ariaLabel="Select Segment"
              layoutId="segment-asset"
              value={field.value}
              onChange={(next) => {
                field.onChange(next);
                onSegmentChange?.(next);
              }}
              options={ASSET_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          )
        }
      />
    </div>
  );
}
