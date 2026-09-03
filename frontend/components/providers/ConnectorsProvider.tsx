"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ensureConnectorsAccount, logoutConnectors } from "@/lib/connectors/auth";
import { clearConnectorsBootstrap, peekConnectorsBootstrap } from "@/lib/connectors/bootstrap";
import { connectorsApi, isConnectorsConfigured, refreshConnectorsToken } from "@/lib/connectors/api";
import {
  clearStoredConnection,
  getConnectorsAccessToken,
  getStoredConnection,
  setStoredConnection,
} from "@/lib/connectors/storage";
import type { ConnectorsHealth, StoredBrokerConnection } from "@/lib/connectors/types";

interface ConnectorsContextValue {
  configured: boolean;
  authenticated: boolean;
  authLoading: boolean;
  health: ConnectorsHealth | null;
  healthLoading: boolean;
  connection: StoredBrokerConnection | null;
  logout: () => void;
  saveConnection: (connection: StoredBrokerConnection) => void;
  clearConnection: () => void;
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
  const [connection, setConnection] = useState<StoredBrokerConnection | null>(null);

  useEffect(() => {
    setConnection(getStoredConnection());

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

  const logout = useCallback(() => {
    logoutConnectors();
    clearConnectorsBootstrap();
    setAuthenticated(false);
    setConnection(null);
    qc.removeQueries({ queryKey: ["connectors"] });
  }, [qc]);

  const saveConnection = useCallback((next: StoredBrokerConnection) => {
    setStoredConnection(next);
    setConnection(next);
  }, []);

  const clearConnection = useCallback(() => {
    clearStoredConnection();
    setConnection(null);
  }, []);

  const value = useMemo<ConnectorsContextValue>(
    () => ({
      configured,
      authenticated,
      authLoading,
      health: health ?? null,
      healthLoading,
      connection,
      logout,
      saveConnection,
      clearConnection,
    }),
    [
      configured,
      authenticated,
      authLoading,
      health,
      healthLoading,
      connection,
      logout,
      saveConnection,
      clearConnection,
    ]
  );

  return <ConnectorsContext.Provider value={value}>{children}</ConnectorsContext.Provider>;
}

export function useConnectors() {
  const ctx = useContext(ConnectorsContext);
  if (!ctx) throw new Error("useConnectors must be used within ConnectorsProvider");
  return ctx;
}
