"use client";

import { UseFormRegister } from "react-hook-form";

import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, tradeTextareaClass } from "@/components/trade/ui";

export function NotesEditor({ register }: { register: UseFormRegister<AddTradeFormValues> }) {
  return (
    <div data-field="notes">
      <FieldLabel>Notes</FieldLabel>
      <textarea
        {...register("notes")}
        rows={5}
        maxLength={5000}
        placeholder="Why did you take this trade? What did you see?"
        className={tradeTextareaClass}
      />
    </div>
  );
}
