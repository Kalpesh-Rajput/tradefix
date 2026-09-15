"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ensureConnectorsAccount, logoutConnectors } from "@/lib/connectors/auth";
import { clearConnectorsBootstrap, peekConnectorsBootstrap } from "@/lib/connectors/bootstrap";
import { connectorsApi, isConnectorsConfigured, refreshConnectorsToken } from "@/lib/connectors/api";
import {
  getConnectorsAccessToken,
  getConnectionMap,
  removeStoredConnection,
  resolveStoredConnection,
  setStoredConnection,
  UNASSIGNED_CONNECTION_KEY,
} from "@/lib/connectors/storage";
import type { ConnectorsHealth, StoredBrokerConnection } from "@/lib/connectors/types";

interface ConnectorsContextValue {
  configured: boolean;
  authenticated: boolean;
  authLoading: boolean;
  health: ConnectorsHealth | null;
  healthLoading: boolean;
  connections: Record<string, StoredBrokerConnection>;
  connection: StoredBrokerConnection | null;
  connectionFor: (accountId?: string | null) => StoredBrokerConnection | null;
  logout: () => void;
  saveConnection: (connection: StoredBrokerConnection, accountId?: string | null) => void;
  clearConnection: (opts?: { accountId?: string | null; connectionId?: string | null }) => void;
  linkConnectionToAccount: (accountId: string) => void;
}

const ConnectorsContext = createContext<ConnectorsContextValue | undefined>(undefined);

export function ConnectorsProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const qc = useQueryClient();
  const configured = isConnectorsConfigured();
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [connections, setConnections] = useState<Record<string, StoredBrokerConnection>>({});

  useEffect(() => {
    setConnections(getConnectionMap());

    if (!configured || !enabled) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    async function initConnectorsAuth() {
      const existing = getConnectorsAccessToken();
      if (existing) {
        const ok = await refreshConnectorsToken();
        if (!cancelled) {
          setAuthenticated(ok);
          setAuthLoading(false);
        }
        return;
      }

      const bootstrap = peekConnectorsBootstrap();
      if (bootstrap) {
        const result = await ensureConnectorsAccount(bootstrap.email, bootstrap.password);
        if (result.ok) clearConnectorsBootstrap();
        if (!cancelled) {
          setAuthenticated(result.ok);
          setAuthLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setAuthenticated(false);
        setAuthLoading(false);
      }
    }

    void initConnectorsAuth();

    return () => {
      cancelled = true;
    };
  }, [configured, enabled]);

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["connectors", "health"],
    queryFn: () => connectorsApi.health(),
    enabled: configured && enabled,
    staleTime: 60_000,
    retry: 1,
  });

  const connectionFor = useCallback(
    (accountId?: string | null) => resolveStoredConnection(connections, accountId),
    [connections]
  );

  const logout = useCallback(() => {
    logoutConnectors();
    clearConnectorsBootstrap();
    setAuthenticated(false);
    setConnections({});
    qc.removeQueries({ queryKey: ["connectors"] });
  }, [qc]);

  const saveConnection = useCallback((next: StoredBrokerConnection, accountId?: string | null) => {
    setConnections(setStoredConnection(next, accountId));
  }, []);

  const clearConnection = useCallback(
    (opts?: { accountId?: string | null; connectionId?: string | null }) => {
      setConnections(removeStoredConnection(opts));
    },
    []
  );

  const linkConnectionToAccount = useCallback((accountId: string) => {
    setConnections((current) => {
      const unassigned = current[UNASSIGNED_CONNECTION_KEY];
      if (!unassigned) return current;
      return setStoredConnection(unassigned, accountId);
    });
  }, []);

  const connection = useMemo(() => connectionFor(null), [connectionFor]);

  const value = useMemo<ConnectorsContextValue>(
    () => ({
      configured,
      authenticated,
      authLoading,
      health: health ?? null,
      healthLoading,
      connections,
      connection,
      connectionFor,
      logout,
      saveConnection,
      clearConnection,
      linkConnectionToAccount,
    }),
    [
      configured,
      authenticated,
      authLoading,
      health,
      healthLoading,
      connections,
      connection,
      connectionFor,
      logout,
      saveConnection,
      clearConnection,
      linkConnectionToAccount,
    ]
  );

  return <ConnectorsContext.Provider value={value}>{children}</ConnectorsContext.Provider>;
}

export function useConnectors() {
  const ctx = useContext(ConnectorsContext);
  if (!ctx) throw new Error("useConnectors must be used within ConnectorsProvider");
  return ctx;
}
