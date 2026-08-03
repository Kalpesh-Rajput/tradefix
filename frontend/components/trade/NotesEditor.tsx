"use client";

import { UseFormRegister, UseFormWatch } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel } from "@/components/trade/ui";

export function NotesEditor({
  register,
  watch,
}: {
  register: UseFormRegister<AddTradeFormValues>;
  watch: UseFormWatch<AddTradeFormValues>;
}) {
  watch("notes");

  return (
    <div>
      <FieldLabel>Notes</FieldLabel>
      <textarea
        {...register("notes")}
        rows={3}
        maxLength={5000}
        placeholder="Why did you take this trade? What did you see?"
        className="w-full resize-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40"
      />
    </div>
  );
}
