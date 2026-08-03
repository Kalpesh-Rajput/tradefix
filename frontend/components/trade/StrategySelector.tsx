"use client";

import { Control, Controller } from "react-hook-form";

import { AddTradeFormValues, MISTAKES, STRATEGIES, WENT_WELL } from "@/components/trade/schema";
import { ChipGroup } from "@/components/trade/ui";

export function StrategySelector({ control }: { control: Control<AddTradeFormValues> }) {
  return (
    <Controller
      control={control}
      name="strategies"
      render={({ field }) => <ChipGroup options={STRATEGIES} value={field.value} onChange={field.onChange} />}
    />
  );
}

export function MistakeSelector({ control }: { control: Control<AddTradeFormValues> }) {
  return (
    <Controller
      control={control}
      name="mistakes"
      render={({ field }) => (
        <ChipGroup options={MISTAKES} value={field.value} onChange={field.onChange} tone="danger" />
      )}
    />
  );
}

export function PositiveSelector({ control }: { control: Control<AddTradeFormValues> }) {
  return (
    <Controller
      control={control}
      name="wentWell"
      render={({ field }) => <ChipGroup options={WENT_WELL} value={field.value} onChange={field.onChange} />}
    />
  );
}
