import type { BrokerCatalogItem } from "@/lib/connectors/types";

export type BrokerCategoryId = "forex" | "crypto" | "futures" | "other";

export interface BrokerCategory {
  id: BrokerCategoryId;
  label: string;
  description: string;
}

const BROKER_CATEGORY: Record<string, BrokerCategoryId> = {
  mt5: "forex",
  exness: "forex",
  ctrader: "forex",
  matchtrader: "forex",
  binance: "crypto",
  bybit: "crypto",
  bitget: "crypto",
  okx: "crypto",
  delta: "crypto",
  tradovate: "futures",
  ninjatrader: "futures",
  tradeninja: "futures",
  tradingview: "other",
};

export const BROKER_CATEGORIES: BrokerCategory[] = [
  {
    id: "forex",
    label: "Forex",
    description: "MT5, cTrader & prop platforms — login + investor password",
  },
  {
    id: "crypto",
    label: "Crypto",
    description: "Spot & futures exchanges — read-only API keys",
  },
  {
    id: "futures",
    label: "Futures",
    description: "Tradovate & NinjaTrader — username + API password",
  },
  {
    id: "other",
    label: "Other",
    description: "Webhook & alert-based integrations",
  },
];

export function brokerCategoryId(brokerId: string): BrokerCategoryId {
  return BROKER_CATEGORY[brokerId.toLowerCase()] ?? "other";
}

export function groupBrokersByCategory(brokers: BrokerCatalogItem[]): Map<BrokerCategoryId, BrokerCatalogItem[]> {
  const map = new Map<BrokerCategoryId, BrokerCatalogItem[]>();
  for (const cat of BROKER_CATEGORIES) {
    map.set(cat.id, []);
  }
  for (const broker of brokers) {
    const cat = brokerCategoryId(broker.id);
    map.get(cat)?.push(broker);
  }
  return map;
}

export function filterBrokers(brokers: BrokerCatalogItem[], query: string): BrokerCatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return brokers;
  return brokers.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      BROKER_CATEGORIES.find((c) => c.id === brokerCategoryId(b.id))?.label.toLowerCase().includes(q)
  );
}
