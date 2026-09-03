"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useConnectors } from "@/components/providers/ConnectorsProvider";
import { importBrokerTradesToJournal } from "@/lib/connectors/import-trades";
import { connectorsApi, ConnectorsApiError } from "@/lib/connectors/api";
import type { BrokerConnectPayload, StoredBrokerConnection } from "@/lib/connectors/types";

export function useBrokerCatalog() {
  const { configured } = useConnectors();
  return useQuery({
    queryKey: ["connectors", "catalog"],
    queryFn: () => connectorsApi.catalog(),
    enabled: configured,
    staleTime: 300_000,
  });
}

export function useBrokerConnect() {
  const qc = useQueryClient();
  const { saveConnection } = useConnectors();

  return useMutation({
    mutationFn: async ({
      payload,
      brokerName,
    }: {
      payload: BrokerConnectPayload;
      brokerName: string;
    }) => {
      const res = await connectorsApi.connect(payload);
      const stored: StoredBrokerConnection = {
        connection_id: res.connection_id,
        broker_id: payload.broker,
        broker_name: brokerName,
        account_number: res.account.account_number,
        server: res.account.server,
        currency: res.account.currency,
        balance: res.account.balance,
        equity: res.account.equity,
        connected_at: new Date().toISOString(),
      };
      saveConnection(stored);
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
}

export function useBrokerSync() {
  const qc = useQueryClient();
  const { connection, saveConnection } = useConnectors();

  return useMutation({
    mutationFn: async (options?: { importToJournal?: boolean; accountId?: string }) => {
      if (!connection) throw new ConnectorsApiError("No broker connection", 400);
      const sync = await connectorsApi.sync(connection.connection_id);
      const journal = await connectorsApi.trades(connection.connection_id);

      saveConnection({
        ...connection,
        last_synced_at: sync.last_synced_at,
        balance: connection.balance,
      });

      let importResult = null;
      if (options?.importToJournal && options.accountId) {
        importResult = await importBrokerTradesToJournal(journal.trades, options.accountId);
      }

      return { sync, journal, importResult };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
      qc.invalidateQueries({ queryKey: ["trades"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useBrokerDisconnect() {
  const qc = useQueryClient();
  const { connection, clearConnection } = useConnectors();

  return useMutation({
    mutationFn: async () => {
      if (!connection) throw new ConnectorsApiError("No broker connection", 400);
      return connectorsApi.disconnect(connection.connection_id);
    },
    onSuccess: () => {
      clearConnection();
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
}

export function useBrokerAccount() {
  const { configured, connection, authenticated } = useConnectors();
  return useQuery({
    queryKey: ["connectors", "account", connection?.connection_id],
    queryFn: () => connectorsApi.account(connection!.connection_id),
    enabled: configured && authenticated && Boolean(connection?.connection_id),
    staleTime: 30_000,
  });
}
