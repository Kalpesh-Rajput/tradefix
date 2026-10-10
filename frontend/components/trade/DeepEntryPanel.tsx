"use client";

import { Minus, Plus } from "lucide-react";
import { Controller, UseFormReturn, useFormState } from "react-hook-form";

import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { MasterMultiCombobox } from "@/components/trade/MasterMultiCombobox";
import { NotesEditor } from "@/components/trade/NotesEditor";
import { ScreenshotUploader, Shot } from "@/components/trade/ScreenshotUploader";
import { capitalPresentation, RiskPlanFields } from "@/components/trade/SegmentSpecificFields";
import { AddTradeFormValues } from "@/components/trade/schema";
import { TradeSelect } from "@/components/trade/TradeSelect";
import { FieldSlot, FormSection, tradeGridClass } from "@/components/trade/ui";
import { useLiveTradeCalc } from "@/components/trade/useLiveTradeCalc";
import { fmtMoney } from "@/lib/format";

export function hasDeepEntryData(values: AddTradeFormValues, screenshotCount = 0) {
  const hasStop = values.stop_loss != null && String(values.stop_loss) !== "";
  return Boolean(
    hasStop ||
      values.entry_condition ||
      values.mood.length ||
      values.precheck_list_id ||
      values.playbook_id ||
      values.strategies.length ||
      values.mistakes.length ||
      values.wentWell.length ||
      values.notes?.trim() ||
      screenshotCount
  );
}

export function DeepEntryPanel({
  form,
  open,
  onOpenChange,
  precheckLists,
  playbooks,
  shots,
  onShotsChange,
  onDeleteSaved,
}: {
  form: UseFormReturn<AddTradeFormValues>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  precheckLists: { id: string; name: string }[];
  playbooks: { id: string; name: string; icon?: string | null }[];
  shots: Shot[];
  onShotsChange: (shots: Shot[]) => void;
  onDeleteSaved?: (url: string) => void;
}) {
  const { control, register } = form;
  const { errors } = useFormState({ control });
  const { calc, assetType, side, leverage } = useLiveTradeCalc(control);
  const capital = capitalPresentation(assetType, side, leverage, calc);
  const risk = calc.riskAmount != null ? fmtMoney(calc.riskAmount, { signed: false }) : "—";

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-left transition-colors duration-150 hover:border-primary/35 hover:bg-[var(--color-primary-very-light)]"
      >
        <span className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-[var(--color-text-primary)]">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </span>
          Deep Entry
        </span>
        <span className="flex shrink-0 items-center gap-4">
          <span className="text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{capital.label}</span>
            <span className="block font-mono text-[13px] font-medium text-[var(--color-text-secondary)]">{capital.value}</span>
          </span>
          <span className="text-right">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">Risk</span>
            <span className="block font-mono text-[13px] font-medium text-[var(--color-text-secondary)]">{risk}</span>
          </span>
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden" inert={open ? undefined : true}>
          <div className="space-y-1 pt-1">
            <FormSection title="Trade execution">
              <div className={tradeGridClass}>
                <FieldSlot name="analysis_timeframe">
                  <Controller
                    control={control}
                    name="analysis_timeframe"
                    render={({ field }) => (
                      <MasterCombobox
                        category="timeframe"
                        label="Analysis TF"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select timeframe"
                      />
                    )}
                  />
                </FieldSlot>
                <FieldSlot name="entry_timeframe">
                  <Controller
                    control={control}
                    name="entry_timeframe"
                    render={({ field }) => (
                      <MasterCombobox
                        category="timeframe"
                        label="Entry TF"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Select timeframe"
                      />
                    )}
                  />
                </FieldSlot>
              </div>
            </FormSection>

            <FormSection title="Risk">
              <RiskPlanFields
                register={register}
                errors={errors}
                asset={assetType}
                side={side}
                leverage={leverage}
                calc={calc}
              />
              <FieldSlot name="entry_condition" className="mt-3">
                <Controller
                  control={control}
                  name="entry_condition"
                  render={({ field }) => (
                    <MasterCombobox
                      category="entry_condition"
                      label="Entry condition"
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Select entry condition"
                    />
                  )}
                />
              </FieldSlot>
            </FormSection>

            <FormSection title="Trade context">
              <div className={tradeGridClass}>
                <FieldSlot name="mood">
                  <Controller
                    control={control}
                    name="mood"
                    render={({ field }) => (
                      <MasterMultiCombobox
                        category="mood"
                        label="Mood"
                        value={field.value ?? []}
                        onChange={field.onChange}
                        placeholder="Select mood"
                      />
                    )}
                  />
                </FieldSlot>
                <FieldSlot name="precheck_list_id">
                  <Controller
                    control={control}
                    name="precheck_list_id"
                    render={({ field }) => (
                      <TradeSelect
                        label="Pre-checklist"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="None"
                        options={[
                          { value: "", label: "None" },
                          ...precheckLists.map((list) => ({ value: list.id, label: list.name })),
                        ]}
                      />
                    )}
                  />
                </FieldSlot>
                <FieldSlot name="playbook_id">
                  <Controller
                    control={control}
                    name="playbook_id"
                    render={({ field }) => (
                      <TradeSelect
                        label="Playbook"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="None"
                        options={[
                          { value: "", label: "None" },
                          ...playbooks.map((playbook) => ({
                            value: playbook.id,
                            label: `${playbook.icon ? `${playbook.icon} ` : ""}${playbook.name}`,
                          })),
                        ]}
                      />
                    )}
                  />
                </FieldSlot>
                <FieldSlot name="strategies">
                  <Controller
                    control={control}
                    name="strategies"
                    render={({ field }) => (
                      <MasterMultiCombobox
                        category="strategy"
                        label="Strategies"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select strategies"
                      />
                    )}
                  />
                </FieldSlot>
              </div>
            </FormSection>

            <FormSection title="Trade review">
              <div className={tradeGridClass}>
                <FieldSlot name="mistakes">
                  <Controller
                    control={control}
                    name="mistakes"
                    render={({ field }) => (
                      <MasterMultiCombobox
                        category="mistake"
                        label="Mistakes"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select mistakes"
                      />
                    )}
                  />
                </FieldSlot>
                <FieldSlot name="wentWell">
                  <Controller
                    control={control}
                    name="wentWell"
                    render={({ field }) => (
                      <MasterMultiCombobox
                        category="went_well"
                        label="What went well"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select what went well"
                      />
                    )}
                  />
                </FieldSlot>
              </div>
            </FormSection>

            <FormSection title="Notes & evidence">
              <NotesEditor register={register} />
              <ScreenshotUploader files={shots} onChange={onShotsChange} onDeleteSaved={onDeleteSaved} max={3} />
            </FormSection>
          </div>
        </div>
      </div>
    </div>
  );
}
