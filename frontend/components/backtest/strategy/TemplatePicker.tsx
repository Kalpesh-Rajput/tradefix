"use client";

import { STRATEGY_TEMPLATES, type StrategyDefinition } from "@/lib/backtest/strategyForm";

export function TemplatePicker({ onPick }: { onPick: (definition: StrategyDefinition) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {STRATEGY_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-lg border border-border bg-surface px-3 py-3 text-left hover:border-primary"
          onClick={() => onPick(structuredClone(template.definition))}
        >
          <span className="block text-sm font-medium text-foreground">{template.label}</span>
          <span className="mt-1 block text-xs text-muted">{template.blurb}</span>
        </button>
      ))}
    </div>
  );
}
