"use client";

import type { DrawingStore } from "../store";
import { defaultFibLevels } from "../tools";
import type { Drawing, FibLevel } from "../types";
import { FIELD_BASE } from "./fields";

export function FibLevelsEditor({ drawing, store }: { drawing: Drawing; store: DrawingStore }) {
  const levels = drawing.props.levels ?? [];
  const write = (next: FibLevel[]) => store.patch(drawing.id, { props: { ...drawing.props, levels: next } });
  const update = (index: number, change: Partial<FibLevel>) => write(levels.map((level, i) => (i === index ? { ...level, ...change } : level)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Levels</h3>
        <button
          type="button"
          onClick={() => write(defaultFibLevels(drawing.tool))}
          className="rounded px-1.5 py-0.5 text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Reset
        </button>
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {levels.map((level, index) => (
          <li key={index} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={level.enabled}
              onChange={(event) => update(index, { enabled: event.target.checked })}
              aria-label={`Show level ${level.label}`}
              className="h-3.5 w-3.5 accent-[var(--accent-hex)]"
            />
            <input
              aria-label={`Level ${index + 1} value`}
              defaultValue={level.value}
              key={`v-${level.value}`}
              inputMode="decimal"
              onBlur={(event) => {
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed) || parsed < -10 || parsed > 20) {
                  event.target.value = String(level.value);
                  return;
                }
                const followed = level.label === String(level.value);
                update(index, { value: parsed, label: followed ? String(parsed) : level.label });
              }}
              className={`${FIELD_BASE} w-16 shrink-0`}
            />
            <input
              aria-label={`Level ${index + 1} label`}
              defaultValue={level.label}
              key={`l-${level.label}`}
              maxLength={16}
              onBlur={(event) => {
                const text = event.target.value.trim();
                if (!text) event.target.value = level.label;
                else if (text !== level.label) update(index, { label: text });
              }}
              className={`${FIELD_BASE} min-w-0 flex-1`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
