"use client";

import { Plus, Trash2 } from "lucide-react";
import { Control, Controller, FieldErrors, UseFormRegister, useFieldArray, useWatch } from "react-hook-form";

import { currentClock } from "@/components/trade/DateTimePicker";
import { DateTimeMomentField } from "@/components/trade/EntryMomentPicker";
import { FeeField } from "@/components/trade/FeeField";
import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel, formNumberClass } from "@/components/trade/ui";
import { fmtMoney } from "@/lib/format";
import { calculateExitPnl, positionValue, type TradeCalcResult } from "@/lib/tradeCalc";

function statusLabel(status: TradeCalcResult["displayStatus"]): string {
  if (status === "partially_closed") return "Partially closed";
  if (status === "closed") return "Closed";
  return "Open";
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function PartialFillsEditor({
  control,
  register,
  errors,
  calc,
}: {
  control: Control<AddTradeFormValues>;
  register: UseFormRegister<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  calc: TradeCalcResult;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "exits" });
  const asset = useWatch({ control, name: "asset_type" });
  const side = useWatch({ control, name: "side" });
  const symbol = useWatch({ control, name: "symbol" });
  const entryPrice = Number(useWatch({ control, name: "entry_price" }) || 0);
  const contractSize = useWatch({ control, name: "contract_size" });
  const exitRows = useWatch({ control, name: "exits" }) ?? [];
  const isForex = asset === "forex";
  const qtyLabel = isForex ? "Exit lots" : "Exit qty";
  const remainingLabel = isForex ? "Remaining lots" : "Remaining qty";

  return (
    <div className="space-y-3" data-field="exits">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Partial profit / exits
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Add one or more closes against the same trade.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            append({
              quantity: "" as unknown as number,
              price: "" as unknown as number,
              date: localDate(),
              time: currentClock(),
              condition: "",
              fees: 0,
            })
          }
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-primary hover:border-primary/40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add exit
        </button>
      </div>
      {fields.length === 0 && (
        <div className="rounded-[10px] border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
          No exits yet
          <br />
          Trade stays open.
        </div>
      )}
      <div className="space-y-3">
        {fields.map((field, index) => {
          const row = exitRows[index];
          const qty = Number(row?.quantity || 0);
          const price = Number(row?.price || 0);
          const fees = Number(row?.fees || 0);
          const gross =
            qty > 0 && price > 0 && entryPrice > 0
              ? calculateExitPnl({
                  assetType: asset,
                  symbol: symbol || "AAPL",
                  side,
                  quantity: qty,
                  entryPrice,
                  exitPrice: price,
                  contractSize: contractSize != null ? Number(contractSize) : null,
                })
              : null;
          const net = gross != null ? Math.round((gross - fees) * 100) / 100 : null;
          return (
            <div key={field.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Exit {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-destructive"
                  aria-label={`Remove exit ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel error={errors.exits?.[index]?.quantity?.message as string | undefined}>{qtyLabel}</FieldLabel>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={errors.exits?.[index]?.quantity ? true : undefined}
                    className={formNumberClass(errors.exits?.[index]?.quantity?.message as string | undefined)}
                    {...register(`exits.${index}.quantity`)}
                  />
                </div>
                <div>
                  <FieldLabel error={errors.exits?.[index]?.price?.message as string | undefined}>Exit price</FieldLabel>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-invalid={errors.exits?.[index]?.price ? true : undefined}
                    className={formNumberClass(errors.exits?.[index]?.price?.message as string | undefined)}
                    {...register(`exits.${index}.price`)}
                  />
                </div>
                <Controller
                  control={control}
                  name={`exits.${index}.date`}
                  render={({ field: dateField }) => (
                    <Controller
                      control={control}
                      name={`exits.${index}.time`}
                      render={({ field: timeField }) => (
                        <DateTimeMomentField
                          date={dateField.value || ""}
                          time={timeField.value || ""}
                          onDateChange={dateField.onChange}
                          onTimeChange={timeField.onChange}
                          label="Date & time"
                          error={
                            (errors.exits?.[index]?.date?.message as string | undefined) ||
                            (errors.exits?.[index]?.time?.message as string | undefined)
                          }
                        />
                      )}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`exits.${index}.fees`}
                  render={({ field: feeField }) => (
                    <FeeField
                      label="Fees"
                      amount={feeField.value}
                      basis={positionValue({
                        assetType: asset,
                        symbol: symbol || "",
                        quantity: qty,
                        entryPrice: price,
                        contractSize: contractSize != null ? Number(contractSize) : null,
                      })}
                      basisLabel="exit value"
                      onChange={feeField.onChange}
                      error={errors.exits?.[index]?.fees?.message as string | undefined}
                    />
                  )}
                />
              </div>
              {gross != null && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <MiniStat label="Gross P&L" value={fmtMoney(gross)} tone={gross >= 0 ? "profit" : "loss"} />
                  <MiniStat label="Fees" value={fmtMoney(fees, { signed: false })} />
                  <MiniStat label="Net P&L" value={fmtMoney(net ?? 0)} tone={(net ?? 0) >= 0 ? "profit" : "loss"} />
                </div>
              )}
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
                      placeholder="Select exit condition"
                    />
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
      {typeof errors.exits?.message === "string" && (
        <p className="text-xs text-destructive">{errors.exits.message}</p>
      )}
      {fields.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">Exit summary</p>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
              {statusLabel(calc.displayStatus)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <SummaryRow label="Total exited" value={String(calc.sellQuantity)} />
            <SummaryRow label="Avg exit price" value={calc.exitPrice != null ? String(calc.exitPrice) : "—"} />
            <SummaryRow label={remainingLabel} value={String(calc.remainingQuantity)} />
            <SummaryRow
              label="Realized gross"
              value={calc.realizedGross != null ? fmtMoney(calc.realizedGross) : "—"}
              tone={calc.realizedGross != null ? (calc.realizedGross >= 0 ? "profit" : "loss") : undefined}
            />
            <SummaryRow label="Total fees" value={fmtMoney(calc.fees, { signed: false })} />
            <SummaryRow
              label="Net P&L"
              value={calc.pnl != null ? fmtMoney(calc.pnl) : "—"}
              tone={calc.pnl != null ? (calc.pnl >= 0 ? "profit" : "loss") : undefined}
            />
          </div>
        </div>
      )}
      {exitRows.length > 0 && (
        <Controller
          control={control}
          name="exit_condition"
          render={({ field }) => (
            <MasterCombobox
              category="exit_condition"
              label="Primary exit condition"
              value={field.value || ""}
              onChange={field.onChange}
              placeholder="Select exit condition"
            />
          )}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
      <p className="text-[var(--color-text-muted)]">{label}</p>
      <p className={`font-mono ${tone === "profit" ? "text-emerald-600" : tone === "loss" ? "text-destructive" : "text-[var(--color-text-primary)]"}`}>
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5">
      <p className="text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`font-mono ${
          tone === "profit" ? "text-emerald-600" : tone === "loss" ? "text-destructive" : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
