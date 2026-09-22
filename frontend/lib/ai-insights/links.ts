import type { AiInsightTradeFilter } from "@/lib/types";

export function tradesHref(filter?: AiInsightTradeFilter | null): string {
  if (!filter) return "/trades";
  const params = new URLSearchParams();
  if (filter.ids?.length) params.set("ids", filter.ids.join(","));
  if (filter.setup_tag) params.set("setup_tag", filter.setup_tag);
  if (filter.symbol) params.set("symbol", filter.symbol);
  if (filter.session) params.set("session", filter.session);
  if (filter.side) params.set("side", filter.side);
  if (filter.date_from) params.set("date_from", filter.date_from.slice(0, 10));
  if (filter.date_to) params.set("date_to", filter.date_to.slice(0, 10));
  if (filter.auto_flag) params.set("auto_flag", filter.auto_flag);
  if (filter.has_rules_broken) params.set("has_rules_broken", "true");
  const qs = params.toString();
  return qs ? `/trades?${qs}` : "/trades";
}

export function chatHref(question: string): string {
  return `/chat?q=${encodeURIComponent(question)}`;
}
