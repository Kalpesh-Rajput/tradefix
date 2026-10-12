import type { AdvancedFilterValue } from "@/lib/trades/logFilters";

export type DashboardJournalQuery = AdvancedFilterValue & {
  today: string;
  pnl_mode: "net" | "gross";
};

const PARAMS: Array<[keyof AdvancedFilterValue, string]> = [
  ["status", "adv_status"],
  ["asset_type", "adv_asset_type"],
  ["side", "adv_side"],
  ["setup_tag", "adv_setup_tag"],
  ["symbol", "adv_symbol"],
  ["session", "adv_session"],
  ["holding", "adv_holding"],
  ["pnl", "adv_pnl"],
  ["fees", "adv_fees"],
  ["risk", "adv_risk"],
  ["roi", "adv_roi"],
  ["rating", "adv_rating"],
  ["r_multiple", "adv_r_multiple"],
  ["weekday", "adv_weekday"],
  ["mood", "adv_mood"],
  ["emotion", "adv_emotion"],
  ["journal", "adv_journal"],
  ["rules", "adv_rules"],
];

export function appendDashboardFilters(
  params: URLSearchParams,
  query: DashboardJournalQuery | null | undefined
) {
  if (!query) return;
  for (const [field, name] of PARAMS) {
    const value = query[field];
    if (!value || value === "all") continue;
    params.set(name, value);
  }
  if (query.holding && query.today) params.set("adv_today", query.today);
  if (query.pnl_mode === "gross" && (query.pnl || query.roi)) params.set("pnl_mode", "gross");
}

export function dashboardFilterKey(query: DashboardJournalQuery | null | undefined): string {
  if (!query) return "";
  const parts = PARAMS.map(([field]) => query[field] || "");
  parts.push(query.holding ? query.today : "");
  parts.push(query.pnl_mode === "gross" && (query.pnl || query.roi) ? "gross" : "net");
  return parts.join("|");
}
