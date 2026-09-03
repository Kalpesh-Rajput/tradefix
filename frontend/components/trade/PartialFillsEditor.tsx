"use client";

import { Plus, Trash2 } from "lucide-react";
import { Control, Controller, FieldErrors, UseFormRegister, UseFormWatch, useFieldArray } from "react-hook-form";

import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel } from "@/components/trade/ui";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40 disabled:opacity-40";

export function PartialFillsEditor({
  control,
  register,
  watch,
  errors,
}: {
  control: Control<AddTradeFormValues>;
  register: UseFormRegister<AddTradeFormValues>;
  watch: UseFormWatch<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "exits" });
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted">Partial profit / exits</p>
        <button
          type="button"
          onClick={() =>
            append({
              quantity: "" as unknown as number,
              price: "" as unknown as number,
              date,
              time,
              condition: "",
            })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Add exit
        </button>
      </div>
      <p className="text-[11px] text-muted">
        Add one or more closes against the same trade. Remaining quantity stays open until exits cover the full size.
      </p>
      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted">
          No exits yet — trade stays open. Add a partial or full close when you book profit.
        </div>
      )}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400">Exit {index + 1}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded p-1 text-zinc-500 hover:text-destructive"
                aria-label={`Remove exit ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <FieldLabel error={errors.exits?.[index]?.quantity?.message as string | undefined}>Qty</FieldLabel>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className={`${inputClass} font-mono`}
                  {...register(`exits.${index}.quantity`)}
                />
              </div>
              <div>
                <FieldLabel error={errors.exits?.[index]?.price?.message as string | undefined}>Price</FieldLabel>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className={`${inputClass} font-mono`}
                  {...register(`exits.${index}.price`)}
                />
              </div>
              <div>
                <FieldLabel>Date</FieldLabel>
                <input type="date" className={inputClass} {...register(`exits.${index}.date`)} />
              </div>
              <div>
                <FieldLabel>Time</FieldLabel>
                <input type="time" className={`${inputClass} [color-scheme:dark]`} {...register(`exits.${index}.time`)} />
              </div>
            </div>
            <div className="mt-2">
              <Controller
                control={control}
                name={`exits.${index}.condition`}
                render={({ field: cond }) => (
                  <MasterCombobox
                    category="exit_condition"
                    label="Exit condition"
                    value={cond.value || ""}
                    onChange={cond.onChange}
                    placeholder="Target hit, stop…"
                  />
                )}
              />
            </div>
          </div>
        ))}
      </div>
      {watch("exits")?.length > 0 && (
        <Controller
          control={control}
          name="exit_condition"
          render={({ field }) => (
            <MasterCombobox
              category="exit_condition"
              label="Primary exit condition"
              value={field.value || ""}
              onChange={field.onChange}
              placeholder="Used when a row has none"
            />
          )}
        />
      )}
    </div>
  );
}
