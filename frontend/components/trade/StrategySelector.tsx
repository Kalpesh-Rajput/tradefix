"use client";

import { Control, Controller } from "react-hook-form";
import { useMemo } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { AddTradeFormValues, WENT_WELL } from "@/components/trade/schema";
import { ChipGroup } from "@/components/trade/ui";
import { resolveEmotionCatalog } from "@/lib/emotions";
import { resolveMistakeCatalog, resolveStrategyCatalog } from "@/lib/tradingDefaults";

export function StrategySelector({
  control,
  extraOptions = [],
}: {
  control: Control<AddTradeFormValues>;
  extraOptions?: string[];
}) {
  const { user } = useAuth();
  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...resolveStrategyCatalog(user), ...extraOptions]) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name.trim());
    }
    return out;
  }, [user, extraOptions]);

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
