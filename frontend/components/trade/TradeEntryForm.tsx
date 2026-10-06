"use client";

import { UseFormReturn } from "react-hook-form";

import { DeepEntryPanel } from "@/components/trade/DeepEntryPanel";
import { ExecutionBoard } from "@/components/trade/ExecutionBoard";
import { Shot } from "@/components/trade/ScreenshotUploader";
import { AddTradeFormValues } from "@/components/trade/schema";
import { TradeIdentityFields } from "@/components/trade/TradeIdentityFields";

export function TradeEntryForm({
  form,
  accounts,
  precheckLists,
  playbooks,
  symbolSuggestions,
  onSegmentChange,
  shots,
  onShotsChange,
  onDeleteSaved,
  deepOpen,
  onDeepOpenChange,
}: {
  form: UseFormReturn<AddTradeFormValues>;
  accounts: { id: string; name: string }[];
  precheckLists: { id: string; name: string }[];
  playbooks: { id: string; name: string; icon?: string | null }[];
  symbolSuggestions: string[];
  onSegmentChange: (next: AddTradeFormValues["asset_type"]) => void;
  shots: Shot[];
  onShotsChange: (shots: Shot[]) => void;
  onDeleteSaved?: (url: string) => void;
  deepOpen: boolean;
  onDeepOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <TradeIdentityFields
        form={form}
        accounts={accounts}
        symbolSuggestions={symbolSuggestions}
        onSegmentChange={onSegmentChange}
      />
      <ExecutionBoard form={form} />
      <DeepEntryPanel
        form={form}
        open={deepOpen}
        onOpenChange={onDeepOpenChange}
        precheckLists={precheckLists}
        playbooks={playbooks}
        shots={shots}
        onShotsChange={onShotsChange}
        onDeleteSaved={onDeleteSaved}
      />
    </div>
  );
}
