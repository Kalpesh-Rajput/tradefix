import type { StoredBrokerConnection } from "@/lib/connectors/types";

const ACCESS_KEY = "tradefix_connectors_access_token";
const REFRESH_KEY = "tradefix_connectors_refresh_token";
const CONNECTION_KEY = "tradefix_broker_connection";
const IMPORTED_KEY = "tradefix_broker_imported_ids";

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

export function getStoredConnection(): StoredBrokerConnection | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CONNECTION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredBrokerConnection;
  } catch {
    return null;
  }
}

export function setStoredConnection(connection: StoredBrokerConnection): void {
  window.localStorage.setItem(CONNECTION_KEY, JSON.stringify(connection));
}

export function clearStoredConnection(): void {
  window.localStorage.removeItem(CONNECTION_KEY);
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
  clearStoredConnection();
}
