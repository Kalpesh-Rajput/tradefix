import type { FieldErrors } from "react-hook-form";

const FIELD_ORDER = [
  "symbol",
  "entryDate",
  "entryTime",
  "quantity",
  "entry_price",
  "option_type",
  "strike_price",
  "expiry_date",
  "stop_loss",
  "fees",
  "leverage",
  "contract_size",
  "tick_size",
  "tick_value",
  "analysis_timeframe",
  "entry_timeframe",
  "plan_compliance",
  "entry_condition",
  "exits",
  "mood",
  "precheck_list_id",
  "playbook_id",
  "strategies",
  "mistakes",
  "wentWell",
  "notes",
];

export const DEEP_FIELDS = new Set([
  "stop_loss",
  "analysis_timeframe",
  "entry_timeframe",
  "plan_compliance",
  "entry_condition",
  "mood",
  "precheck_list_id",
  "playbook_id",
  "strategies",
  "mistakes",
  "wentWell",
  "notes",
]);

export function firstErrorField(errors: FieldErrors): string | null {
  for (const key of FIELD_ORDER) {
    if (errors[key]) return key;
  }
  const keys = Object.keys(errors);
  return keys[0] ?? null;
}

export function collectErrorMessages(errors: FieldErrors): string[] {
  const acc: string[] = [];
  walk(errors, acc);
  return acc;
}

function walk(node: unknown, acc: string[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, acc));
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.message === "string" && record.message) acc.push(record.message);
  for (const [key, value] of Object.entries(record)) {
    if (key === "message" || key === "type" || key === "ref" || key === "types") continue;
    walk(value, acc);
  }
}
