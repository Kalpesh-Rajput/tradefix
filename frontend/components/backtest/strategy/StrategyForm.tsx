"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { RuleGroup } from "@/components/backtest/strategy/RuleGroup";
import { TemplatePicker } from "@/components/backtest/strategy/TemplatePicker";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ApiError, api } from "@/lib/api";
import {
  TIMEFRAMES,
  blankStrategy,
  type StrategyDefinition,
} from "@/lib/backtest/strategyForm";
import { useMarketInstruments } from "@/lib/hooks/useBacktestSessions";
import { useCreateStrategy, useDeleteStrategy, useUpdateStrategy, type StrategyValidation } from "@/lib/hooks/useStrategies";

const FIELD = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary";

function toLocal(ms: number) {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function StrategyForm({ strategyId, initial }: { strategyId?: string; initial?: StrategyDefinition }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const instruments = useMarketInstruments();
  const create = useCreateStrategy();
  const update = useUpdateStrategy();
  const remove = useDeleteStrategy();
  const [definition, setDefinition] = useState<StrategyDefinition>(initial ?? blankStrategy());
  const [validation, setValidation] = useState<StrategyValidation | null>(null);
  const [sizeMode, setSizeMode] = useState<"fixed" | "risk">(definition.risk.fixed_size != null ? "fixed" : "risk");
  const [busy, setBusy] = useState<"save" | "run" | "delete" | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      api
        .post<StrategyValidation>("/api/strategies/validate", definition)
        .then(setValidation)
        .catch(() => setValidation(null));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [definition]);

  function patch(partial: Partial<StrategyDefinition>) {
    setDefinition((current) => ({ ...current, ...partial }));
  }

  function fieldErrors(field: string) {
    return (validation?.errors ?? []).filter((error) => error.field === field).map((error) => error.message);
  }

  async function persist(): Promise<string | null> {
    try {
      if (strategyId) {
        const saved = await update.mutateAsync({ id: strategyId, definition });
        return saved.id;
      }
      const saved = await create.mutateAsync(definition);
      return saved.id;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Try again.";
      const details = error instanceof ApiError ? (error.details as { errors?: StrategyValidation["errors"] } | undefined) : undefined;
      if (details?.errors) setValidation({ ok: false, errors: details.errors, estimated_bars: validation?.estimated_bars ?? null });
      toast.error("Couldn’t save the strategy", message);
      return null;
    }
  }

  async function onSave() {
    setBusy("save");
    const id = await persist();
    setBusy(null);
    if (!id) return;
    toast.success("Strategy saved", definition.name);
    if (!strategyId) router.push(`/backtest/strategies/${id}`);
  }

  async function onRun() {
    setBusy("run");
    const id = await persist();
    if (!id) {
      setBusy(null);
      return;
    }
    try {
      const run = await api.post<{ id: string }>("/api/backtests", { strategy_id: id });
      toast.success("Backtest queued", definition.name);
      router.push(`/backtest/runs/${run.id}`);
    } catch (error) {
      toast.error("Couldn’t start the run", error instanceof ApiError ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onDuplicate() {
    const copy = { ...definition, name: `Copy of ${definition.name}`.slice(0, 80) };
    try {
      const saved = await create.mutateAsync(copy);
      toast.success("Strategy duplicated", saved.name);
      router.push(`/backtest/strategies/${saved.id}`);
    } catch (error) {
      toast.error("Couldn’t duplicate", error instanceof ApiError ? error.message : "Try again.");
    }
  }

  async function onDelete() {
    if (!strategyId) return;
    const ok = await confirm({
      title: "Delete this strategy?",
      description: `${definition.name} will be removed. This cannot be undone.`,
      confirmLabel: "Delete strategy",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete");
    try {
      await remove.mutateAsync(strategyId);
      toast.success("Strategy deleted");
      router.push("/backtest");
    } catch (error) {
      toast.error("Couldn’t delete", error instanceof ApiError ? error.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  const longEntry = definition.long_entry;
  const shortEntry = definition.short_entry;

  return (
    <form
      className="dash-card space-y-6 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <div>
        <h1 className="text-lg font-semibold text-foreground">{strategyId ? "Edit strategy" : "New strategy"}</h1>
        <p className="mt-1 text-sm text-muted">
          Templates fill the form and are not saved until you save or run. The default window is EUR/USD, 2 March–1 April 2026, which is inside the loaded candles.
        </p>
      </div>
      <TemplatePicker onPick={(next) => {
        setDefinition(next);
        setSizeMode(next.risk.fixed_size != null ? "fixed" : "risk");
      }} />

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" errors={fieldErrors("name")}>
          <input className={FIELD} value={definition.name} onChange={(event) => patch({ name: event.target.value })} />
        </Field>
        <Field label="Description" errors={fieldErrors("description")}>
          <input className={FIELD} value={definition.description} onChange={(event) => patch({ description: event.target.value })} />
        </Field>
        <Field label="Instrument" errors={fieldErrors("market.symbol")}>
          <select className={FIELD} value={definition.market.symbol} onChange={(event) => patch({ market: { ...definition.market, symbol: event.target.value } })}>
            {(instruments.data ?? []).map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.symbol}
              </option>
            ))}
            {(instruments.data ?? []).some((item) => item.symbol === definition.market.symbol) ? null : (
              <option value={definition.market.symbol}>{definition.market.symbol}</option>
            )}
          </select>
        </Field>
        <Field label="Timeframe" errors={fieldErrors("market.timeframe")}>
          <select
            className={FIELD}
            value={definition.market.timeframe}
            onChange={(event) => patch({ market: { ...definition.market, timeframe: event.target.value as StrategyDefinition["market"]["timeframe"] } })}
          >
            {TIMEFRAMES.map((timeframe) => (
              <option key={timeframe} value={timeframe}>
                {timeframe}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start" errors={fieldErrors("market.start_ms")}>
          <input
            className={FIELD}
            type="datetime-local"
            value={toLocal(definition.market.start_ms)}
            onChange={(event) => patch({ market: { ...definition.market, start_ms: new Date(event.target.value).getTime() } })}
          />
        </Field>
        <Field label="End" errors={fieldErrors("market.end_ms")}>
          <input
            className={FIELD}
            type="datetime-local"
            value={toLocal(definition.market.end_ms)}
            onChange={(event) => patch({ market: { ...definition.market, end_ms: new Date(event.target.value).getTime() } })}
          />
        </Field>
        <Field label="Direction" errors={fieldErrors("direction")}>
          <select className={FIELD} value={definition.direction} onChange={(event) => patch({ direction: event.target.value as StrategyDefinition["direction"] })}>
            <option value="long">Long</option>
            <option value="short">Short</option>
            <option value="both">Both</option>
          </select>
        </Field>
      </section>
      {fieldErrors("market").map((message) => (
        <p key={message} className="text-sm text-negative">{message}</p>
      ))}

      {definition.direction !== "short" ? (
        longEntry ? (
          <RuleGroup title="Long entry" group={longEntry} onChange={(long_entry) => patch({ long_entry })} />
        ) : (
          <button type="button" className="dash-btn-secondary h-9 px-3 text-sm" onClick={() => patch({ long_entry: blankStrategy().long_entry })}>
            Add long entry
          </button>
        )
      ) : null}
      {definition.direction !== "long" ? (
        shortEntry ? (
          <RuleGroup title="Short entry" group={shortEntry} onChange={(short_entry) => patch({ short_entry })} />
        ) : (
          <button type="button" className="dash-btn-secondary h-9 px-3 text-sm" onClick={() => patch({ short_entry: blankStrategy().long_entry })}>
            Add short entry
          </button>
        )
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="text-sm font-medium text-foreground sm:col-span-2">Exit, filters, risk</h2>
        <Field label="Stop type" errors={fieldErrors("stop_loss")}>
          <select className={FIELD} value={definition.stop_loss.type} onChange={(event) => {
            const type = event.target.value as StrategyDefinition["stop_loss"]["type"];
            const needsPeriod = type === "atr" || type === "swing";
            patch({ stop_loss: { ...definition.stop_loss, type, period: needsPeriod ? definition.stop_loss.period ?? 14 : null, buffer_pips: type === "swing" ? definition.stop_loss.buffer_pips ?? 0 : 0 } });
          }}>
            {["pips", "atr", "percent", "swing"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Stop value" errors={fieldErrors("stop_loss.value")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.stop_loss.value} onChange={(event) => patch({ stop_loss: { ...definition.stop_loss, value: Number(event.target.value) } })} />
        </Field>
        {definition.stop_loss.type === "atr" || definition.stop_loss.type === "swing" ? (
          <Field label="Stop period" errors={fieldErrors("stop_loss.period")}>
            <input className={FIELD} type="number" min={2} value={definition.stop_loss.period ?? 14} onChange={(event) => patch({ stop_loss: { ...definition.stop_loss, period: Number(event.target.value) } })} />
          </Field>
        ) : null}
        {definition.stop_loss.type === "swing" ? (
          <Field label="Swing buffer (pips)" errors={fieldErrors("stop_loss.buffer_pips")}>
            <input className={FIELD} type="number" min={0} step="any" value={definition.stop_loss.buffer_pips ?? 0} onChange={(event) => patch({ stop_loss: { ...definition.stop_loss, buffer_pips: Number(event.target.value) } })} />
          </Field>
        ) : null}
        <Field label="Minimum stop distance (pips)" errors={fieldErrors("stop_loss.min_distance_pips")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.stop_loss.min_distance_pips ?? 0} onChange={(event) => patch({ stop_loss: { ...definition.stop_loss, min_distance_pips: Number(event.target.value) } })} />
        </Field>
        <Field label="Target type" errors={fieldErrors("take_profit")}>
          <select className={FIELD} value={definition.take_profit.type} onChange={(event) => {
            const type = event.target.value as StrategyDefinition["take_profit"]["type"];
            patch({ take_profit: { ...definition.take_profit, type, period: type === "atr" ? definition.take_profit.period ?? 14 : null } });
          }}>
            {["r", "pips", "atr"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Target value" errors={fieldErrors("take_profit.value")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.take_profit.value} onChange={(event) => patch({ take_profit: { ...definition.take_profit, value: Number(event.target.value) } })} />
        </Field>
        {definition.take_profit.type === "atr" ? (
          <Field label="Target period" errors={fieldErrors("take_profit.period")}>
            <input className={FIELD} type="number" min={2} value={definition.take_profit.period ?? 14} onChange={(event) => patch({ take_profit: { ...definition.take_profit, period: Number(event.target.value) } })} />
          </Field>
        ) : null}
        <Field label="Weekdays (0 Mon – 6 Sun, comma separated)" errors={fieldErrors("filters.weekdays")}>
          <input className={FIELD} value={definition.filters.weekdays.join(", ")} onChange={(event) => patch({ filters: { ...definition.filters, weekdays: parseNumbers(event.target.value) } })} />
        </Field>
        <Field label="Hours UTC" errors={fieldErrors("filters.hours")}>
          <input className={FIELD} value={definition.filters.hours.join(", ")} onChange={(event) => patch({ filters: { ...definition.filters, hours: parseNumbers(event.target.value) } })} />
        </Field>
        <Field label="Min bars between entries" errors={fieldErrors("filters.min_bars_between")}>
          <input className={FIELD} type="number" min={0} value={definition.filters.min_bars_between} onChange={(event) => patch({ filters: { ...definition.filters, min_bars_between: Number(event.target.value) } })} />
        </Field>
        <Field label="Max trades per UTC day" errors={fieldErrors("filters.max_trades_per_day")}>
          <input className={FIELD} type="number" min={1} value={definition.filters.max_trades_per_day ?? ""} onChange={(event) => patch({ filters: { ...definition.filters, max_trades_per_day: event.target.value === "" ? null : Number(event.target.value) } })} />
        </Field>
        <Field label="Starting balance" errors={fieldErrors("risk.initial_balance")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.risk.initial_balance} onChange={(event) => patch({ risk: { ...definition.risk, initial_balance: Number(event.target.value) } })} />
        </Field>
        <Field label="Size" errors={[...fieldErrors("risk"), ...fieldErrors("risk.fixed_size"), ...fieldErrors("risk.risk_percent")]}>
          <div className="flex gap-2">
            <select className={FIELD} value={sizeMode} onChange={(event) => {
              const mode = event.target.value as "fixed" | "risk";
              setSizeMode(mode);
              patch({
                risk: mode === "fixed"
                  ? { ...definition.risk, fixed_size: definition.risk.fixed_size ?? 0.01, risk_percent: null }
                  : { ...definition.risk, risk_percent: definition.risk.risk_percent ?? 1, fixed_size: null },
              });
            }}>
              <option value="fixed">Fixed size</option>
              <option value="risk">Risk %</option>
            </select>
            <input
              className={FIELD}
              type="number"
              min={0}
              step="any"
              value={sizeMode === "fixed" ? definition.risk.fixed_size ?? "" : definition.risk.risk_percent ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                patch({
                  risk: sizeMode === "fixed"
                    ? { ...definition.risk, fixed_size: value, risk_percent: null }
                    : { ...definition.risk, risk_percent: value, fixed_size: null },
                });
              }}
            />
          </div>
        </Field>
        <Field label="Spread (pips)" errors={fieldErrors("costs.spread_pips")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.costs.spread_pips} onChange={(event) => patch({ costs: { ...definition.costs, spread_pips: Number(event.target.value) } })} />
        </Field>
        <Field label="Commission per lot" errors={fieldErrors("costs.commission_per_lot")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.costs.commission_per_lot} onChange={(event) => patch({ costs: { ...definition.costs, commission_per_lot: Number(event.target.value) } })} />
        </Field>
        <Field label="Slippage (pips)" errors={fieldErrors("costs.slippage_pips")}>
          <input className={FIELD} type="number" min={0} step="any" value={definition.costs.slippage_pips} onChange={(event) => patch({ costs: { ...definition.costs, slippage_pips: Number(event.target.value) } })} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={definition.exit_on_opposite} onChange={(event) => patch({ exit_on_opposite: event.target.checked })} />
          Close and reverse when the opposite entry is true
        </label>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted">
          {validation == null ? "Checking…" : validation.ok ? `About ${validation.estimated_bars ?? 0} bars.` : `${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {strategyId ? (
            <>
              <button type="button" className="dash-btn-secondary h-10 px-3 text-sm" onClick={() => void onDuplicate()}>Duplicate</button>
              <button type="button" className="dash-btn-secondary h-10 px-3 text-sm" disabled={busy != null} onClick={() => void onDelete()}>Delete</button>
            </>
          ) : null}
          <button type="submit" className="dash-btn-secondary h-10 px-3 text-sm" disabled={busy != null}>{busy === "save" ? "Saving…" : "Save"}</button>
          <button type="button" className="dash-btn-primary h-10 px-3 text-sm" disabled={busy != null} onClick={() => void onRun()}>{busy === "run" ? "Starting…" : "Run backtest"}</button>
        </div>
      </div>
      {(validation?.errors ?? [])
        .filter((error) => !["name", "description", "market.symbol", "market", "direction", "stop_loss", "take_profit", "risk"].includes(error.field))
        .map((error) => (
          <p key={`${error.field}-${error.message}`} className="text-sm text-negative">
            {error.field}: {error.message}
          </p>
        ))}
    </form>
  );
}

function Field({ label, errors, children }: { label: string; errors: string[]; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
      {errors.map((message) => (
        <span key={message} className="mt-1 block text-xs text-negative">{message}</span>
      ))}
    </label>
  );
}

function parseNumbers(value: string): number[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}
