"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Control, Controller } from "react-hook-form";

import { ASSET_OPTIONS, AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel } from "@/components/trade/ui";

export function AssetSelector({
  control,
  error,
}: {
  control: Control<AddTradeFormValues>;
  error?: string;
}) {
  return (
    <div>
      <FieldLabel error={error}>Asset Class</FieldLabel>
      <Controller
        control={control}
        name="asset_type"
        render={({ field }) => (
          <div className="flex flex-wrap gap-2">
            {ASSET_OPTIONS.map((opt) => {
              const active = field.value === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => field.onChange(opt.value)}
                  className={clsx(
                    "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/10 text-zinc-400 hover:text-white"
                  )}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
        )}
      />
    </div>
  );
}
