"use client";

import { Control, Controller } from "react-hook-form";

import { useAuth } from "@/components/providers/AuthProvider";
import { AddTradeFormValues, WENT_WELL } from "@/components/trade/schema";
import { ChipGroup } from "@/components/trade/ui";
import { resolveEmotionCatalog } from "@/lib/emotions";
import { resolveMistakeCatalog, resolveStrategyCatalog } from "@/lib/tradingDefaults";

export function StrategySelector({ control }: { control: Control<AddTradeFormValues> }) {
  const { user } = useAuth();
  const options = resolveStrategyCatalog(user);

  return (
    <Controller
      control={control}
      name="strategies"
      render={({ field }) => <ChipGroup options={options} value={field.value} onChange={field.onChange} />}
    />
  );
}

export function EmotionSelector({ control }: { control: Control<AddTradeFormValues> }) {
  const { user } = useAuth();
  const options = resolveEmotionCatalog(user);

  return (
    <Controller
      control={control}
      name="emotions"
      render={({ field }) => <ChipGroup options={options} value={field.value} onChange={field.onChange} />}
    />
  );
}

export function MistakeSelector({ control }: { control: Control<AddTradeFormValues> }) {
  const { user } = useAuth();
  const options = resolveMistakeCatalog(user);

  return (
    <Controller
      control={control}
      name="mistakes"
      render={({ field }) => (
        <ChipGroup options={options} value={field.value} onChange={field.onChange} tone="danger" />
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
