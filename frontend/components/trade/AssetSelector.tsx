"use client";

import { Control, Controller } from "react-hook-form";

import { ASSET_OPTIONS, AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, SegmentedControl } from "@/components/trade/ui";

export function AssetSelector({
  control,
  error,
  onSegmentChange,
}: {
  control: Control<AddTradeFormValues>;
  error?: string;
  onSegmentChange?: (next: AddTradeFormValues["asset_type"]) => void;
}) {
  return (
    <div data-field="asset_type">
      <FieldLabel error={error}>Select Segment</FieldLabel>
      <Controller
        control={control}
        name="asset_type"
        render={({ field }) => (
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
        )}
      />
    </div>
  );
}
