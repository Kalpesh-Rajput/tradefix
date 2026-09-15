import type { StoredBrokerConnection } from "@/lib/connectors/types";

const ACCESS_KEY = "tradefix_connectors_access_token";
const REFRESH_KEY = "tradefix_connectors_refresh_token";
const LEGACY_CONNECTION_KEY = "tradefix_broker_connection";
const CONNECTION_MAP_KEY = "tradefix_broker_connections";
const IMPORTED_KEY = "tradefix_broker_imported_ids";

export const UNASSIGNED_CONNECTION_KEY = "__unassigned__";

export function getConnectorsAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getConnectorsRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setConnectorsTokens(access: string, refresh: string): void {
  window.localStorage.setItem(ACCESS_KEY, access);
  window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearConnectorsTokens(): void {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

function isStoredConnection(value: unknown): value is StoredBrokerConnection {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.connection_id === "string" && typeof record.broker_id === "string";
}

function writeMap(map: Record<string, StoredBrokerConnection>): Record<string, StoredBrokerConnection> {
  window.localStorage.setItem(CONNECTION_MAP_KEY, JSON.stringify(map));
  return map;
}

function readMap(): Record<string, StoredBrokerConnection> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(CONNECTION_MAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isStoredConnection(parsed)) {
        const migrated = { [UNASSIGNED_CONNECTION_KEY]: parsed };
        return writeMap(migrated);
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const map: Record<string, StoredBrokerConnection> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (isStoredConnection(value)) map[key] = value;
        }
        return map;
      }
    }
  } catch {
    // fall through to legacy
  }

  try {
    const legacy = window.localStorage.getItem(LEGACY_CONNECTION_KEY);
    if (legacy) {
      const conn = JSON.parse(legacy) as unknown;
      if (isStoredConnection(conn)) {
        const map = { [UNASSIGNED_CONNECTION_KEY]: conn };
        window.localStorage.removeItem(LEGACY_CONNECTION_KEY);
        return writeMap(map);
      }
    }
  } catch {
    // ignore
  }

  return {};
}

export function getConnectionMap(): Record<string, StoredBrokerConnection> {
  return readMap();
}

export function resolveStoredConnection(
  map: Record<string, StoredBrokerConnection>,
  accountId?: string | null
): StoredBrokerConnection | null {
  if (accountId) return map[accountId] ?? null;
  return map[UNASSIGNED_CONNECTION_KEY] ?? null;
}

export function getStoredConnection(accountId?: string | null): StoredBrokerConnection | null {
  return resolveStoredConnection(readMap(), accountId);
}

export function setStoredConnection(
  connection: StoredBrokerConnection,
  accountId?: string | null
): Record<string, StoredBrokerConnection> {
  const map = readMap();
  const key = accountId || connection.journal_account_id || UNASSIGNED_CONNECTION_KEY;
  const next: StoredBrokerConnection = {
    ...connection,
    journal_account_id: accountId ?? connection.journal_account_id ?? null,
  };
  for (const existingKey of Object.keys(map)) {
    if (map[existingKey]?.connection_id === next.connection_id) delete map[existingKey];
  }
  map[key] = next;
  return writeMap(map);
}

export function removeStoredConnection(opts?: {
  accountId?: string | null;
  connectionId?: string | null;
}): Record<string, StoredBrokerConnection> {
  const map = readMap();
  const connectionId = opts?.connectionId;
  const accountId = opts?.accountId;
  if (connectionId) {
    for (const key of Object.keys(map)) {
      if (map[key]?.connection_id === connectionId) delete map[key];
    }
  } else if (accountId) {
    delete map[accountId];
  } else {
    delete map[UNASSIGNED_CONNECTION_KEY];
  }
  return writeMap(map);
}

export function clearStoredConnection(accountId?: string | null): Record<string, StoredBrokerConnection> {
  return removeStoredConnection({ accountId });
}

export function clearAllStoredConnections(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONNECTION_MAP_KEY);
  window.localStorage.removeItem(LEGACY_CONNECTION_KEY);
}

export function getImportedBrokerTradeIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = window.localStorage.getItem(IMPORTED_KEY);
  if (!raw) return new Set();
  try {
    const ids = JSON.parse(raw) as string[];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export function addImportedBrokerTradeIds(ids: string[]): void {
  const existing = getImportedBrokerTradeIds();
  for (const id of ids) existing.add(id);
  window.localStorage.setItem(IMPORTED_KEY, JSON.stringify([...existing]));
}

export function clearConnectorsSession(): void {
  clearConnectorsTokens();
  clearAllStoredConnections();
}
