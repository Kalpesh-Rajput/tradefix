"use client";

import { INDICATORS, OPERATORS, describeCondition, type Condition, type Operand } from "@/lib/backtest/strategyForm";

const FIELD = "h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-primary";

export function ConditionCard({
  condition,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  condition: Condition;
  index: number;
  total: number;
  onChange: (next: Condition) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr]">
        <OperandFields operand={condition.left} onChange={(left) => onChange({ ...condition, left })} />
        <label className="block text-xs text-muted">
          Operator
          <select className={FIELD} value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value as Condition["operator"] })}>
            {OPERATORS.map((operator) => (
              <option key={operator} value={operator}>
                {operator.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <OperandFields operand={condition.right} onChange={(right) => onChange({ ...condition, right })} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground">{describeCondition(condition)}</p>
        <div className="flex gap-1">
          <button type="button" className="dash-btn-secondary h-8 px-2 text-xs" disabled={index === 0} onClick={() => onMove(-1)}>
            Up
          </button>
          <button type="button" className="dash-btn-secondary h-8 px-2 text-xs" disabled={index === total - 1} onClick={() => onMove(1)}>
            Down
          </button>
          <button type="button" className="dash-btn-secondary h-8 px-2 text-xs" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function OperandFields({ operand, onChange }: { operand: Operand; onChange: (next: Operand) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="col-span-2 block text-xs text-muted">
        Operand
        <select
          className={FIELD}
          value={operand.kind}
          onChange={(event) => onChange(kindDefaults(event.target.value as Operand["kind"]))}
        >
          <option value="price">Price</option>
          <option value="indicator">Indicator</option>
          <option value="constant">Constant</option>
        </select>
      </label>
      {operand.kind === "price" ? (
        <>
          <label className="block text-xs text-muted">
            Field
            <select className={FIELD} value={operand.field ?? "close"} onChange={(event) => onChange({ ...operand, field: event.target.value as Operand["field"] })}>
              {["open", "high", "low", "close"].map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Bars ago
            <input className={FIELD} type="number" min={0} max={50} value={operand.offset ?? 0} onChange={(event) => onChange({ ...operand, offset: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
      {operand.kind === "indicator" ? (
        <>
          <label className="block text-xs text-muted">
            Indicator
            <select className={FIELD} value={operand.name ?? "sma"} onChange={(event) => onChange({ ...operand, name: event.target.value })}>
              {INDICATORS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Period
            <input className={FIELD} type="number" min={2} max={500} value={operand.period ?? 14} onChange={(event) => onChange({ ...operand, period: Number(event.target.value) })} />
          </label>
          <label className="col-span-2 block text-xs text-muted">
            Output
            <input className={FIELD} value={operand.output ?? ""} placeholder="value, upper, k…" onChange={(event) => onChange({ ...operand, output: event.target.value || null })} />
          </label>
        </>
      ) : null}
      {operand.kind === "constant" ? (
        <label className="col-span-2 block text-xs text-muted">
          Value
          <input className={FIELD} type="number" value={operand.value ?? 0} onChange={(event) => onChange({ ...operand, value: Number(event.target.value) })} />
        </label>
      ) : null}
    </div>
  );
}

function kindDefaults(kind: Operand["kind"]): Operand {
  if (kind === "price") return { kind, field: "close", offset: 0 };
  if (kind === "indicator") return { kind, name: "sma", period: 20, output: null, offset: 0 };
  return { kind, value: 0, offset: 0 };
}
