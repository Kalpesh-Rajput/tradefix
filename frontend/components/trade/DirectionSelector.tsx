"use client";

import { ChevronDown } from "lucide-react";
import { Control, Controller } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, SegmentedControl, tableInputClass } from "@/components/trade/ui";

export function DirectionSelector({
  control,
  variant = "segmented",
}: {
  control: Control<AddTradeFormValues>;
  variant?: "segmented" | "cell";
}) {
  return (
    <div data-field="side">
      {variant === "cell" ? null : <FieldLabel>Direction</FieldLabel>}
      <Controller
        control={control}
        name="side"
        render={({ field }) =>
          variant === "cell" ? (
            <div className="relative">
              <select
                aria-label="Direction"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                className={`${tableInputClass()} appearance-none pr-7`}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            </div>
          ) : (
            <SegmentedControl
              ariaLabel="Direction"
              layoutId="direction-seg"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "long", label: "Long" },
                { value: "short", label: "Short" },
              ]}
            />
          )
        }
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
            ariaLabel="Trade Status"
            layoutId="status-seg"
            tone="neutral"
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
