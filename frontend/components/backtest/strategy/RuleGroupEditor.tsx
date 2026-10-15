"use client";

import { ConditionCard } from "@/components/backtest/strategy/ConditionCard";
import { emptyCondition, type Condition, type RuleGroup } from "@/lib/backtest/strategyForm";

export function RuleGroupEditor({
  title,
  group,
  onChange,
}: {
  title: string;
  group: RuleGroup;
  onChange: (next: RuleGroup) => void;
}) {
  function updateCondition(index: number, next: Condition) {
    const conditions = group.conditions.slice();
    conditions[index] = next;
    onChange({ ...group, conditions });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= group.conditions.length) return;
    const conditions = group.conditions.slice();
    const [row] = conditions.splice(index, 1);
    conditions.splice(target, 0, row);
    onChange({ ...group, conditions });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          Match
          <select
            className="h-9 rounded-lg border border-border bg-surface px-2 text-foreground"
            value={group.combine}
            onChange={(event) => onChange({ ...group, combine: event.target.value as RuleGroup["combine"] })}
          >
            <option value="all">all conditions</option>
            <option value="any">any condition</option>
          </select>
        </label>
      </div>
      {group.conditions.map((condition, index) => (
        <ConditionCard
          key={`${index}-${condition.operator}`}
          condition={condition}
          index={index}
          total={group.conditions.length}
          onChange={(next) => updateCondition(index, next)}
          onRemove={() => onChange({ ...group, conditions: group.conditions.filter((_, item) => item !== index) })}
          onMove={(direction) => move(index, direction)}
        />
      ))}
      <button type="button" className="dash-btn-secondary h-9 px-3 text-sm" onClick={() => onChange({ ...group, conditions: [...group.conditions, emptyCondition()] })}>
        Add condition
      </button>
      {group.groups.map((nested, index) => (
        <div key={index} className="rounded-lg border border-dashed border-border p-3">
          <RuleGroupEditor
            title={`Nested group ${index + 1}`}
            group={{ ...nested, groups: [] }}
            onChange={(next) => {
              const groups = group.groups.slice();
              groups[index] = { combine: next.combine, conditions: next.conditions };
              onChange({ ...group, groups });
            }}
          />
          <button
            type="button"
            className="mt-2 text-xs text-muted hover:text-foreground"
            onClick={() => onChange({ ...group, groups: group.groups.filter((_, item) => item !== index) })}
          >
            Remove nested group
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm text-primary hover:underline"
        onClick={() => onChange({ ...group, groups: [...group.groups, { combine: "all", conditions: [emptyCondition()] }] })}
      >
        Add nested group
      </button>
    </section>
  );
}
