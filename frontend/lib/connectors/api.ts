/** HTTP client for TradeFix-Connectors (same API Flutter uses). */

import {
  clearConnectorsSession,
  getConnectorsAccessToken,
  getConnectorsRefreshToken,
  setConnectorsTokens,
} from "@/lib/connectors/storage";
import type {
  BrokerAccountInfo,
  BrokerCatalogResponse,
  BrokerConnectPayload,
  ConnectorsHealth,
  ConnectorsTokenResponse,
  ConnectResponse,
  JournalTradesResponse,
  SyncResponse,
} from "@/lib/connectors/types";

export const CONNECTORS_URL = (process.env.NEXT_PUBLIC_CONNECTORS_URL || "").replace(/\/$/, "");

export function isConnectorsConfigured(): boolean {
  return Boolean(CONNECTORS_URL);
}

export class ConnectorsApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function defaultHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseErrorDetail(body: unknown, fallback: string): { message: string; code?: string } {
  if (!body || typeof body !== "object") return { message: fallback };
  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string") return { message: detail };
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    const message = typeof d.message === "string" ? d.message : fallback;
    const code = typeof d.error === "string" ? d.error : undefined;
    return { message, code };
  }
  return { message: fallback };
}

async function rawRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  if (!CONNECTORS_URL) {
    throw new ConnectorsApiError("Connectors URL is not configured", 0);
  }

  const headers: Record<string, string> = {
    ...defaultHeaders(token),
    ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${CONNECTORS_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // ignore
    }
    const { message, code } = parseErrorDetail(parsed, res.statusText || "Request failed");
    throw new ConnectorsApiError(message, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function authorizedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getConnectorsAccessToken();
  if (!token) {
    throw new ConnectorsApiError("Not signed in to broker API", 401);
  }

  try {
    return await rawRequest<T>(path, options, token);
  } catch (err) {
    if (!(err instanceof ConnectorsApiError) || err.status !== 401 || err.code) {
      throw err;
    }
    const refreshed = await refreshConnectorsToken();
    if (!refreshed) throw err;
    return rawRequest<T>(path, options, getConnectorsAccessToken());
  }
}

export async function refreshConnectorsToken(): Promise<boolean> {
  const refresh = getConnectorsRefreshToken();
  if (!refresh) return false;

  try {
    const res = await rawRequest<ConnectorsTokenResponse>(
      "/api/auth/refresh",
      { method: "POST", body: JSON.stringify({ refresh_token: refresh }) }
    );
    setConnectorsTokens(res.access_token, res.refresh_token);
    return true;
  } catch {
    clearConnectorsSession();
    return false;
  }
}

export const connectorsApi = {
  health: () => rawRequest<ConnectorsHealth>("/health"),

  register: (email: string, password: string) =>
    rawRequest<{ id: string; email: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    rawRequest<ConnectorsTokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, device_label: "tradefix-web" }),
    }),

  catalog: () => rawRequest<BrokerCatalogResponse>("/api/broker/catalog"),

  connect: (payload: BrokerConnectPayload) =>
    authorizedRequest<ConnectResponse>("/api/broker/connect", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  sync: (connectionId: string, symbols?: string[]) =>
    authorizedRequest<SyncResponse>("/api/broker/sync", {
      method: "POST",
      body: JSON.stringify({ connection_id: connectionId, ...(symbols?.length ? { symbols } : {}) }),
    }),

  trades: (connectionId: string, status?: "open" | "closed") => {
    const params = new URLSearchParams({ connection_id: connectionId });
    if (status) params.set("status", status);
    return authorizedRequest<JournalTradesResponse>(`/api/broker/trades?${params}`);
  },

  account: (connectionId: string) =>
    authorizedRequest<BrokerAccountInfo>(`/api/broker/account?connection_id=${encodeURIComponent(connectionId)}`),

  disconnect: (connectionId: string) =>
    authorizedRequest<{ message: string; connection_id: string }>("/api/broker/disconnect", {
      method: "DELETE",
      body: JSON.stringify({ connection_id: connectionId }),
    }),
};

export function saveConnectorsLogin(res: ConnectorsTokenResponse): void {
  setConnectorsTokens(res.access_token, res.refresh_token);
}
