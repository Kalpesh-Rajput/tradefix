"use client";

import { Control, Controller } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, SegmentedControl } from "@/components/trade/ui";

export function DirectionSelector({ control }: { control: Control<AddTradeFormValues> }) {
  return (
    <div>
      <FieldLabel>Direction</FieldLabel>
      <Controller
        control={control}
        name="side"
        render={({ field }) => (
          <SegmentedControl
            layoutId="direction-seg"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "long", label: "Long" },
              { value: "short", label: "Short" },
            ]}
          />
        )}
      />
    </div>
  );
}

export function TradeStatusSelector({ control }: { control: Control<AddTradeFormValues> }) {
  return (
    <div>
      <FieldLabel>Trade Status</FieldLabel>
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SegmentedControl
            layoutId="status-seg"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "closed", label: "closed" },
              { value: "open", label: "open" },
            ]}
          />
        )}
      />
    </div>
  );
}
