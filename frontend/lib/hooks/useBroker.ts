"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useConnectors } from "@/components/providers/ConnectorsProvider";
import { importBrokerTradesToJournal } from "@/lib/connectors/import-trades";
import { connectorsApi, ConnectorsApiError } from "@/lib/connectors/api";
import type { BrokerConnectPayload, ConnectResponse, StoredBrokerConnection } from "@/lib/connectors/types";

function storedFromConnect(
  payload: BrokerConnectPayload,
  brokerName: string,
  res: ConnectResponse,
  journalAccountId?: string | null
): StoredBrokerConnection {
  return {
    connection_id: res.connection_id,
    broker_id: payload.broker,
    broker_name: brokerName,
    account_number: res.account.account_number,
    server: res.account.server,
    currency: res.account.currency,
    balance: res.account.balance,
    equity: res.account.equity,
    connected_at: new Date().toISOString(),
    journal_account_id: journalAccountId ?? null,
    warning: res.warning ?? null,
    permissions: res.permissions ?? null,
    market_type: res.market_type ?? null,
    symbols: res.symbols ?? null,
    kind: res.kind ?? null,
  };
}

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
      journalAccountId,
    }: {
      payload: BrokerConnectPayload;
      brokerName: string;
      journalAccountId?: string | null;
    }) => {
      const res = await connectorsApi.connect(payload);
      const stored = storedFromConnect(payload, brokerName, res, journalAccountId);
      saveConnection(stored, journalAccountId);
      return { res, stored };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
}

export function useBrokerSync() {
  const qc = useQueryClient();
  const { connectionFor, saveConnection } = useConnectors();

  return useMutation({
    mutationFn: async (options?: { importToJournal?: boolean; accountId?: string }) => {
      const accountId = options?.accountId;
      const connection = connectionFor(accountId) ?? connectionFor(null);
      if (!connection) throw new ConnectorsApiError("No broker connection", 400);
      const sync = await connectorsApi.sync(connection.connection_id);
      const journal = await connectorsApi.trades(connection.connection_id);

      let next: StoredBrokerConnection = {
        ...connection,
        last_synced_at: sync.last_synced_at,
        journal_account_id: accountId ?? connection.journal_account_id ?? null,
      };

      try {
        const live = await connectorsApi.account(connection.connection_id);
        next = {
          ...next,
          account_number: live.account_number,
          server: live.server,
          currency: live.currency,
          balance: live.balance,
          equity: live.equity,
        };
      } catch {
        // keep connect-time snapshot if live account is unavailable
      }

      saveConnection(next, accountId ?? connection.journal_account_id);

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
  const { connectionFor, clearConnection } = useConnectors();

  return useMutation({
    mutationFn: async (accountId?: string | null) => {
      const connection = connectionFor(accountId) ?? connectionFor(null);
      if (!connection) throw new ConnectorsApiError("No broker connection", 400);
      const result = await connectorsApi.disconnect(connection.connection_id);
      clearConnection({ connectionId: connection.connection_id, accountId: accountId ?? connection.journal_account_id });
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
}

export function useBrokerAccount(accountId?: string | null) {
  const { configured, authenticated, connectionFor } = useConnectors();
  const connection = connectionFor(accountId) ?? (!accountId ? connectionFor(null) : null);
  return useQuery({
    queryKey: ["connectors", "account", connection?.connection_id],
    queryFn: () => connectorsApi.account(connection!.connection_id),
    enabled: configured && authenticated && Boolean(connection?.connection_id),
    staleTime: 30_000,
  });
}
