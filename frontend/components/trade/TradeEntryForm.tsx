"use client";

import { Controller, UseFormReturn, useFormState, useWatch } from "react-hook-form";

import { AccountPicker } from "@/components/accounts/AccountPicker";
import { AssetSelector } from "@/components/trade/AssetSelector";
import { EntryMomentFields } from "@/components/trade/EntryMomentPicker";
import { DeepEntryPanel } from "@/components/trade/DeepEntryPanel";
import { DirectionSelector } from "@/components/trade/DirectionSelector";
import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { Shot } from "@/components/trade/ScreenshotUploader";
import { LeverageField, TradeSizeFields } from "@/components/trade/SegmentSpecificFields";
import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, FieldSlot, tradeGridClass } from "@/components/trade/ui";

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
  const { control, register, setValue } = form;
  const { errors } = useFormState({ control });
  const assetType = useWatch({ control, name: "asset_type" });
  const accountId = useWatch({ control, name: "account_id" });

  return (
    <div>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-primary)]">Trade details</h3>
          <div className="h-px flex-1 bg-[var(--color-border)]" />
        </div>
        <AssetSelector control={control} error={errors.asset_type?.message} onSegmentChange={onSegmentChange} />
        <div className={tradeGridClass}>
          <FieldSlot name="account_id">
            <FieldLabel>Account</FieldLabel>
            <AccountPicker
              accounts={accounts}
              value={accountId || ""}
              onChange={(id) => setValue("account_id", id, { shouldDirty: true })}
              tone="trade"
              placeholder="Select account"
            />
          </FieldSlot>
          <FieldSlot name="session">
            <Controller
              control={control}
              name="session"
              render={({ field }) => (
                <MasterCombobox
                  category="session"
                  label="Session"
                  value={field.value || ""}
                  onChange={field.onChange}
                  placeholder="Select session"
                />
              )}
            />
          </FieldSlot>
          <FieldSlot name="trade_type">
            <Controller
              control={control}
              name="trade_type"
              render={({ field }) => (
                <MasterCombobox
                  category="trade_type"
                  label="Trade type"
                  value={field.value || ""}
                  onChange={field.onChange}
                  placeholder="Select trade type"
                />
              )}
            />
          </FieldSlot>
          <LeverageField register={register} errors={errors} asset={assetType} />
        </div>
        <div className={tradeGridClass}>
          <FieldSlot name="symbol">
            <Controller
              control={control}
              name="symbol"
              render={({ field }) => (
                <MasterCombobox
                  category="symbol"
                  label={assetType === "option" ? "Underlying" : "Symbol"}
                  value={field.value || ""}
                  onChange={field.onChange}
                  error={errors.symbol?.message}
                  placeholder="Select symbol"
                  uppercase
                  suggestions={symbolSuggestions}
                />
              )}
            />
          </FieldSlot>
          <DirectionSelector control={control} />
          <EntryMomentFields control={control} dateError={errors.entryDate?.message} timeError={errors.entryTime?.message} />
        </div>
        <TradeSizeFields register={register} control={control} setValue={setValue} errors={errors} />
      </div>
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
