"use client";

import { Plus, Trash2 } from "lucide-react";
import { Control, Controller, FieldErrors, UseFormRegister, UseFormWatch, useFieldArray } from "react-hook-form";

import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { AddTradeFormValues } from "@/components/trade/schema";
import { FieldLabel } from "@/components/trade/ui";
import { fmtMoney } from "@/lib/format";
import { calculateExitPnl, type TradeCalcResult } from "@/lib/tradeCalc";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40 disabled:opacity-40";

function statusLabel(status: TradeCalcResult["displayStatus"]): string {
  if (status === "partially_closed") return "Partially closed";
  if (status === "closed") return "Closed";
  return "Open";
}

export function PartialFillsEditor({
  control,
  register,
  watch,
  errors,
  calc,
}: {
  control: Control<AddTradeFormValues>;
  register: UseFormRegister<AddTradeFormValues>;
  watch: UseFormWatch<AddTradeFormValues>;
  errors: FieldErrors<AddTradeFormValues>;
  calc: TradeCalcResult;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "exits" });
  const asset = watch("asset_type");
  const side = watch("side");
  const symbol = watch("symbol");
  const entryPrice = Number(watch("entry_price") || 0);
  const contractSize = watch("contract_size");
  const isForex = asset === "forex";
  const qtyLabel = isForex ? "Exit lots" : "Exit qty";
  const remainingLabel = isForex ? "Remaining lots" : "Remaining qty";
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const exitRows = watch("exits") ?? [];

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
              fees: 0,
            })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Add exit
        </button>
      </div>
      <p className="text-[11px] text-muted">
        Add one or more closes against the same trade. Remaining {isForex ? "lots stay" : "quantity stays"} open until
        exits cover the full size.
      </p>
      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-muted">
          No exits yet — trade stays open.
          <br />
          Add a partial or full exit when you book profit.
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div>
                  <FieldLabel error={errors.exits?.[index]?.quantity?.message as string | undefined}>
                    {qtyLabel}
                  </FieldLabel>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className={`${inputClass} font-mono`}
                    {...register(`exits.${index}.quantity`)}
                  />
                </div>
                <div>
                  <FieldLabel error={errors.exits?.[index]?.price?.message as string | undefined}>Exit price</FieldLabel>
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
                <div>
                  <FieldLabel error={errors.exits?.[index]?.fees?.message as string | undefined}>Fees</FieldLabel>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    className={`${inputClass} font-mono`}
                    {...register(`exits.${index}.fees`)}
                  />
                </div>
              </div>
              {gross != null && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-1.5">
                    <p className="text-muted">Gross P&L</p>
                    <p className={`font-mono ${gross >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtMoney(gross)}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-1.5">
                    <p className="text-muted">Fees</p>
                    <p className="font-mono text-zinc-300">{fmtMoney(fees, { signed: false })}</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-1.5">
                    <p className="text-muted">Net P&L</p>
                    <p className={`font-mono ${(net ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtMoney(net ?? 0)}
                    </p>
                  </div>
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
                      placeholder="Target hit, stop…"
                    />
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>
      {fields.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted">Exit summary</p>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
              {statusLabel(calc.displayStatus)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            <SummaryRow label="Total exited" value={String(calc.sellQuantity)} />
            <SummaryRow
              label="Avg exit price"
              value={calc.exitPrice != null ? String(calc.exitPrice) : "—"}
              mono
            />
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

function SummaryRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "profit" | "loss";
}) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-black/20 px-2 py-1.5">
      <p className="text-muted">{label}</p>
      <p
        className={`font-mono ${
          tone === "profit" ? "text-emerald-400" : tone === "loss" ? "text-red-400" : mono ? "text-zinc-200" : "text-zinc-300"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
