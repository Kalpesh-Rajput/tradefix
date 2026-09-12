import { BROKER_OPTIONS } from "@/lib/brokers";
import { MT5_SERVERS } from "@/lib/brokers/mt5-servers";
import type { BrokerCatalogItem } from "@/lib/connectors/types";

export interface UnifiedBroker {
  /** Stable id: connectors id when exact connector row, otherwise slug from display name. */
  id: string;
  name: string;
  autoSyncAvailable: boolean;
  connectors?: BrokerCatalogItem;
  /** Company / trade-server names grouped under this platform (e.g. MT5). */
  servers: string[];
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

/** Platform names whose "Platform - Company" rows are servers, not separate brokers. */
const SERVER_PLATFORMS = [
  "MetaTrader 5",
  "MetaTrader 4",
  "cTrader",
  "DxTrade",
  "TradeLocker",
  "ProjectX",
] as const;

function splitServerPlatform(name: string): { platform: string; server: string } | null {
  for (const platform of SERVER_PLATFORMS) {
    const prefix = `${platform} - `;
    if (name.startsWith(prefix)) {
      const server = name.slice(prefix.length).trim();
      if (server) return { platform, server };
    }
    const suffix = ` - ${platform}`;
    if (name.endsWith(suffix) && name !== platform) {
      const server = name.slice(0, -suffix.length).trim();
      if (server) return { platform, server };
    }
  }
  return null;
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

function findPlatform(result: UnifiedBroker[], platform: string): UnifiedBroker | undefined {
  const key = normalizeKey(platform);
  return result.find(
    (broker) =>
      normalizeKey(broker.name) === key ||
      normalizeKey(broker.id) === key ||
      NAME_TO_CONNECTOR_ID[key] === broker.id.toLowerCase()
  );
}

function addServer(broker: UnifiedBroker, server: string) {
  const name = server.trim();
  if (!name) return;
  if (broker.servers.some((item) => item.toLowerCase() === name.toLowerCase())) return;
  broker.servers.push(name);
}

function ensurePlatform(
  result: UnifiedBroker[],
  seenIds: Set<string>,
  seenNames: Set<string>,
  platform: string,
  byId: Map<string, BrokerCatalogItem>
): UnifiedBroker {
  const existing = findPlatform(result, platform);
  if (existing) {
    if (platform.length > existing.name.length) existing.name = platform;
    return existing;
  }

  const linked = resolveConnector(platform, byId);
  const broker: UnifiedBroker = {
    id: linked?.id ?? slugFromName(platform),
    name: platform,
    autoSyncAvailable: linked?.implemented === true,
    connectors: linked,
    servers: [...(linked?.server_hints ?? [])],
  };
  result.push(broker);
  seenIds.add(broker.id.toLowerCase());
  seenNames.add(normalizeKey(platform));
  return broker;
}

/**
 * Merge Connectors catalog + onboarding BROKER_OPTIONS.
 * "MetaTrader 5 - Company" rows become servers under one MetaTrader 5 platform.
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
      servers: [...(item.server_hints ?? [])],
    });
  }

  for (const name of BROKER_OPTIONS) {
    if (name === "Other") continue;

    const split = splitServerPlatform(name);
    if (split) {
      const platform = ensurePlatform(result, seenIds, seenNames, split.platform, byId);
      addServer(platform, split.server);
      continue;
    }

    if ((SERVER_PLATFORMS as readonly string[]).includes(name)) {
      ensurePlatform(result, seenIds, seenNames, name, byId);
      continue;
    }

    const nameKey = normalizeKey(name);
    if (seenNames.has(nameKey)) continue;

    const linked = resolveConnector(name, byId);
    const id = linked && normalizeKey(linked.name) === nameKey ? linked.id : slugFromName(name);
    if (seenIds.has(id.toLowerCase())) {
      const existing = result.find((broker) => broker.id.toLowerCase() === id.toLowerCase());
      if (existing && linked?.server_hints) {
        for (const hint of linked.server_hints) addServer(existing, hint);
      }
      continue;
    }

    seenIds.add(id.toLowerCase());
    seenNames.add(nameKey);
    result.push({
      id,
      name,
      autoSyncAvailable: linked?.implemented === true,
      connectors: linked,
      servers: [...(linked?.server_hints ?? [])],
    });
  }

  const mt5 = ensurePlatform(result, seenIds, seenNames, "MetaTrader 5", byId);
  mt5.servers = [];
  for (const server of MT5_SERVERS) addServer(mt5, server);

  for (const broker of result) {
    broker.servers.sort((a, b) => a.localeCompare(b));
  }

  return result;
}

export function filterUnifiedBrokers(brokers: UnifiedBroker[], query: string): UnifiedBroker[] {
  const raw = query.trim();
  if (!raw) return brokers;
  const q = raw.toLowerCase();
  const nq = normalizeKey(raw);

  if (nq === "mt5" || nq === "meta5" || nq === "metatrader5" || nq === "metatrade5") {
    return brokers.filter(
      (broker) => normalizeKey(broker.name) === "metatrader5" || broker.id.toLowerCase() === "mt5"
    );
  }
  if (nq === "mt4" || nq === "meta4" || nq === "metatrader4" || nq === "metatrade4") {
    return brokers.filter(
      (broker) => normalizeKey(broker.name) === "metatrader4" || broker.id.toLowerCase() === "mt4"
    );
  }

  const startsWith = brokers.filter(
    (broker) =>
      broker.name.toLowerCase().startsWith(q) || normalizeKey(broker.name).startsWith(nq)
  );
  if (startsWith.length > 0) return startsWith;

  return brokers.filter(
    (broker) =>
      broker.name.toLowerCase().includes(q) ||
      broker.id.toLowerCase().includes(q) ||
      broker.servers.some((server) => server.toLowerCase().includes(q))
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

export function matchServerHint(
  broker: UnifiedBroker | null | undefined,
  company: string | null | undefined
): string | null {
  if (!broker || !company) return null;
  const fromHints = broker.connectors?.server_hints ?? [];
  const pool = [...fromHints, ...broker.servers];
  const exact = pool.find((item) => item.toLowerCase() === company.toLowerCase());
  if (exact) return exact;
  const needle = company.toLowerCase().split(/[\s(]/)[0] ?? "";
  if (needle.length < 3) return null;
  return fromHints.find((item) => item.toLowerCase().includes(needle)) ?? null;
}
