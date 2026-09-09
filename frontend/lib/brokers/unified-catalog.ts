import { BROKER_OPTIONS } from "@/lib/brokers";
import type { BrokerCatalogItem } from "@/lib/connectors/types";

export interface UnifiedBroker {
  /** Stable id: connectors id when exact connector row, otherwise slug from display name. */
  id: string;
  name: string;
  autoSyncAvailable: boolean;
  connectors?: BrokerCatalogItem;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function brokerFamily(name: string): string {
  const cut = name.indexOf(" - ");
  return cut === -1 ? name : name.slice(0, cut);
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Map common onboarding / display names onto Connectors catalog ids. */
const NAME_TO_CONNECTOR_ID: Record<string, string> = {
  mt5: "mt5",
  metatrader5: "mt5",
  mt4: "mt4",
  metatrader4: "mt4",
  exness: "exness",
  ctrader: "ctrader",
  matchtrader: "matchtrader",
  "match-trader": "matchtrader",
  binance: "binance",
  bybit: "bybit",
  bitget: "bitget",
  okx: "okx",
  delta: "delta",
  tradovate: "tradovate",
  ninjatrader: "ninjatrader",
  tradeninja: "ninjatrader",
  tradingview: "tradingview",
  tradingviewpapertrading: "tradingview",
};

function resolveConnector(
  name: string,
  byId: Map<string, BrokerCatalogItem>
): BrokerCatalogItem | undefined {
  const family = brokerFamily(name);
  const candidates = [normalizeKey(name), normalizeKey(family)];
  for (const key of candidates) {
    const mapped = NAME_TO_CONNECTOR_ID[key];
    if (mapped && byId.has(mapped)) return byId.get(mapped);
  }
  for (const item of byId.values()) {
    if (
      normalizeKey(item.name) === normalizeKey(family) ||
      normalizeKey(item.name) === normalizeKey(name)
    ) {
      return item;
    }
    if (normalizeKey(item.id) === normalizeKey(family)) return item;
  }
  return undefined;
}

/**
 * Merge Connectors catalog + onboarding BROKER_OPTIONS.
 * Auto-sync availability comes only from connectors.implemented.
 */
export function buildUnifiedBrokerCatalog(connectors: BrokerCatalogItem[] = []): UnifiedBroker[] {
  const byId = new Map(connectors.map((b) => [b.id.toLowerCase(), b]));
  const result: UnifiedBroker[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const item of connectors) {
    const key = item.id.toLowerCase();
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    seenNames.add(normalizeKey(item.name));
    result.push({
      id: item.id,
      name: item.name,
      autoSyncAvailable: item.implemented === true,
      connectors: item,
    });
  }

  for (const name of BROKER_OPTIONS) {
    if (name === "Other") continue;
    const nameKey = normalizeKey(name);
    if (seenNames.has(nameKey)) continue;

    const linked = resolveConnector(name, byId);
    const id = linked && normalizeKey(linked.name) === nameKey ? linked.id : slugFromName(name);
    if (seenIds.has(id.toLowerCase())) continue;

    seenIds.add(id.toLowerCase());
    seenNames.add(nameKey);
    result.push({
      id,
      name,
      autoSyncAvailable: linked?.implemented === true,
      connectors: linked,
    });
  }

  return result;
}

export function filterUnifiedBrokers(brokers: UnifiedBroker[], query: string): UnifiedBroker[] {
  const q = query.trim().toLowerCase();
  if (!q) return brokers;
  return brokers.filter(
    (b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)
  );
}

/** Popular = implemented Connectors first, then a short slice of the rest. */
export function popularUnifiedBrokers(brokers: UnifiedBroker[], limit = 12): UnifiedBroker[] {
  const implemented = brokers.filter((b) => b.autoSyncAvailable);
  const rest = brokers.filter((b) => !b.autoSyncAvailable);
  const out: UnifiedBroker[] = [];
  const seen = new Set<string>();
  for (const b of [...implemented, ...rest]) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
    if (out.length >= limit) break;
  }
  return out;
}
