"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, UseFormReturn, useFieldArray, useFormState, useWatch } from "react-hook-form";

import { currentClock } from "@/components/trade/DateTimePicker";
import { DirectionSelector } from "@/components/trade/DirectionSelector";
import { DateTimeMomentField } from "@/components/trade/EntryMomentPicker";
import { FeeField } from "@/components/trade/FeeField";
import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { AddTradeFormValues } from "@/components/trade/schema";
import { PlainFieldLabel, tableCellClass, tableNumClass } from "@/components/trade/ui";
import { useLiveTradeCalc } from "@/components/trade/useLiveTradeCalc";
import { fmtMoney } from "@/lib/format";
import { calculateExitPnl, positionValue, type TradeCalcResult } from "@/lib/tradeCalc";

const COLUMNS = "2rem 7.5rem minmax(11rem,1.35fr) minmax(6rem,0.8fr) minmax(6.25rem,0.85fr) minmax(11.5rem,1.15fr) 5.5rem";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function statusLabel(status: TradeCalcResult["displayStatus"]): string {
  if (status === "partially_closed") return "Partially closed";
  if (status === "closed") return "Closed";
  return "Open";
}

function RowIndex({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground text-on-accent">
      {n}
    </span>
  );
}

export function ExecutionBoard({ form }: { form: UseFormReturn<AddTradeFormValues> }) {
  const { control, register } = form;
  const { errors } = useFormState({ control });
  const { fields, append, remove } = useFieldArray({ control, name: "exits" });
  const { calc } = useLiveTradeCalc(control);
  const asset = useWatch({ control, name: "asset_type" });
  const side = useWatch({ control, name: "side" });
  const symbol = useWatch({ control, name: "symbol" });
  const entryPrice = Number(useWatch({ control, name: "entry_price" }) || 0);
  const quantity = Number(useWatch({ control, name: "quantity" }) || 0);
  const contractSize = useWatch({ control, name: "contract_size" });
  const exitRows = useWatch({ control, name: "exits" }) ?? [];
  const isForex = asset === "forex";
  const qtyLabel = isForex ? "Lots" : asset === "option" || asset === "future" ? "Contracts" : "Quantity";
  const priceLabel = asset === "option" ? "Premium" : "Entry price";
  const exitQtyLabel = isForex ? "Exit lots" : "Exit qty";
  const remainingLabel = isForex ? "Remaining lots" : "Remaining qty";
  const qtyPlaceholder = asset === "forex" ? "e.g. 10" : asset === "option" ? "e.g. 10" : asset === "future" ? "e.g. 2" : asset === "crypto" ? "e.g. 1" : "e.g. 100";
  const pricePlaceholder =
    asset === "forex" ? "e.g. 1.10000" : asset === "option" ? "e.g. 2.50" : asset === "future" ? "e.g. 4700.50" : asset === "crypto" ? "e.g. 30000" : "e.g. 150.25";
  const feeBasis = positionValue({
    assetType: asset,
    symbol: symbol || "",
    quantity,
    entryPrice,
    contractSize: Number(contractSize) > 0 ? Number(contractSize) : null,
  });

  return (
    <section className="space-y-2" data-field="exits">
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div
            className="grid items-center gap-2 rounded-lg border border-transparent bg-[var(--color-background)] px-2 py-2 text-[12px] font-medium text-[var(--color-text-secondary)] [&>*]:min-w-0"
            style={{ gridTemplateColumns: COLUMNS }}
          >
            <span>#</span>
            <span>Direction</span>
            <span>Entry date & time</span>
            <span>{qtyLabel}</span>
            <span>{priceLabel}</span>
            <span>Brokerage / Fees</span>
            <span className="whitespace-nowrap text-right">Operation</span>
          </div>

          <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2">
            <div className="grid items-center gap-2 [&>*]:min-w-0" style={{ gridTemplateColumns: COLUMNS }}>
              <RowIndex n={1} />
              <DirectionSelector control={control} variant="cell" />
              <Controller
                control={control}
                name="entryDate"
                render={({ field: dateField }) => (
                  <Controller
                    control={control}
                    name="entryTime"
                    render={({ field: timeField }) => (
                      <DateTimeMomentField
                        date={dateField.value || ""}
                        time={timeField.value || ""}
                        onDateChange={dateField.onChange}
                        onTimeChange={timeField.onChange}
                        label="Entry date & time"
                        error={errors.entryDate?.message || errors.entryTime?.message}
                        slotName="entryDate"
                        timeSlotName="entryTime"
                        compact
                      />
                    )}
                  />
                )}
              />
              <FieldCell name="quantity">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={qtyPlaceholder}
                  aria-label={qtyLabel}
                  aria-invalid={errors.quantity ? true : undefined}
                  className={tableNumClass(errors.quantity?.message)}
                  {...register("quantity")}
                />
              </FieldCell>
              <FieldCell name="entry_price">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={pricePlaceholder}
                  aria-label={priceLabel}
                  aria-invalid={errors.entry_price ? true : undefined}
                  className={tableNumClass(errors.entry_price?.message)}
                  {...register("entry_price")}
                />
              </FieldCell>
              <FieldCell name="fees">
                <Controller
                  control={control}
                  name="fees"
                  render={({ field }) => (
                    <FeeField
                      label="Brokerage / Fees"
                      amount={field.value}
                      basis={feeBasis}
                      basisLabel="position value"
                      onChange={field.onChange}
                      error={errors.fees?.message}
                      compact
                    />
                  )}
                />
              </FieldCell>
              <span />
            </div>
          </div>

          <div className="mt-2 space-y-2">
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
              const qtyError = errors.exits?.[index]?.quantity?.message as string | undefined;
              const priceError = errors.exits?.[index]?.price?.message as string | undefined;
              const dateError =
                (errors.exits?.[index]?.date?.message as string | undefined) ||
                (errors.exits?.[index]?.time?.message as string | undefined);
              return (
                <div key={field.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2">
                  <div className="grid items-center gap-2 [&>*]:min-w-0" style={{ gridTemplateColumns: COLUMNS }}>
                    <RowIndex n={index + 2} />
                    <div className={`${tableCellClass} flex items-center text-[var(--color-text-secondary)]`} aria-hidden>
                      Exit
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
                              error={dateError}
                              compact
                            />
                          )}
                        />
                      )}
                    />
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder={qtyPlaceholder}
                      aria-label={exitQtyLabel}
                      aria-invalid={qtyError ? true : undefined}
                      title={qtyError}
                      className={tableNumClass(qtyError)}
                      {...register(`exits.${index}.quantity`)}
                    />
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder={pricePlaceholder}
                      aria-label="Exit price"
                      aria-invalid={priceError ? true : undefined}
                      title={priceError}
                      className={tableNumClass(priceError)}
                      {...register(`exits.${index}.price`)}
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
                          compact
                        />
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-bg)]"
                      aria-label={`Remove exit ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
                    <Controller
                      control={control}
                      name={`exits.${index}.condition`}
                      render={({ field: cond }) => (
                        <div>
                          <PlainFieldLabel>Exit condition</PlainFieldLabel>
                          <MasterCombobox
                            category="exit_condition"
                            label="Exit condition"
                            value={cond.value || ""}
                            onChange={cond.onChange}
                            placeholder="Select exit condition"
                            compact
                            hideLabel
                          />
                        </div>
                      )}
                    />
                    {gross != null ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                        <Stat label="Gross P&L" value={fmtMoney(gross)} tone={gross >= 0 ? "profit" : "loss"} />
                        <Stat label="Fees" value={fmtMoney(fees, { signed: false })} />
                        <Stat label="Net P&L" value={fmtMoney(net ?? 0)} tone={(net ?? 0) >= 0 ? "profit" : "loss"} />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-2">
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
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground text-on-accent transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Execution
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-center text-[12px] text-[var(--color-text-muted)]">No exits yet. Trade stays open.</p>
      ) : null}
      {typeof errors.exits?.message === "string" ? <p className="text-center text-xs text-destructive">{errors.exits.message}</p> : null}

      {fields.length > 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">Exit summary</p>
            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
              {statusLabel(calc.displayStatus)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-3">
            <SummaryCell label="Total exited" value={String(calc.sellQuantity)} />
            <SummaryCell label="Avg exit price" value={calc.exitPrice != null ? String(calc.exitPrice) : "—"} />
            <SummaryCell label={remainingLabel} value={String(calc.remainingQuantity)} />
            <SummaryCell
              label="Realized gross"
              value={calc.realizedGross != null ? fmtMoney(calc.realizedGross) : "—"}
              tone={calc.realizedGross != null ? (calc.realizedGross >= 0 ? "profit" : "loss") : undefined}
            />
            <SummaryCell label="Total fees" value={fmtMoney(calc.fees, { signed: false })} />
            <SummaryCell
              label="Net P&L"
              value={calc.pnl != null ? fmtMoney(calc.pnl) : "—"}
              tone={calc.pnl != null ? (calc.pnl >= 0 ? "profit" : "loss") : undefined}
            />
          </div>
        </div>
      ) : null}

      {exitRows.length > 0 ? (
        <Controller
          control={control}
          name="exit_condition"
          render={({ field }) => (
            <div className="max-w-sm">
              <PlainFieldLabel>Primary exit condition</PlainFieldLabel>
              <MasterCombobox
                category="exit_condition"
                label="Primary exit condition"
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="Select exit condition"
                compact
                hideLabel
              />
            </div>
          )}
        />
      ) : null}
    </section>
  );
}

function FieldCell({ name, children }: { name: string; children: ReactNode }) {
  return <div data-field={name}>{children}</div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={`font-mono font-medium ${tone === "profit" ? "text-emerald-600" : tone === "loss" ? "text-destructive" : "text-[var(--color-text-primary)]"}`}>
        {value}
      </span>
    </span>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5">
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p className={`font-mono text-[13px] font-medium ${tone === "profit" ? "text-emerald-600" : tone === "loss" ? "text-destructive" : "text-[var(--color-text-primary)]"}`}>
        {value}
      </p>
    </div>
  );
}
