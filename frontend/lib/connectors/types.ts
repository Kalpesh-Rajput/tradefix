/** TradeFix-Connectors API types (matches Flutter contract). */

export interface ConnectorsHealth {
  status: string;
  broker_mode: string;
  firebase_sso: string;
}

export interface ConnectorsTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface BrokerCatalogItem {
  id: string;
  name: string;
  kind: "mt5" | "mt4" | "exchange";
  implemented: boolean;
  fields: string[];
  server_hints: string[];
  notes: string;
}

export interface BrokerCatalogResponse {
  brokers: BrokerCatalogItem[];
}

export interface BrokerAccountInfo {
  account_number: number;
  broker: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  currency: string;
  leverage: number;
}

export interface ConnectResponse {
  connection_id: string;
  message: string;
  account: BrokerAccountInfo;
  warning?: string | null;
  permissions?: Record<string, boolean> | null;
  market_type?: string | null;
  symbols?: string[] | null;
  kind?: string | null;
}

export interface SyncResponse {
  connection_id: string;
  closed_upserted: number;
  open_upserted: number;
  closed_created: number;
  open_created: number;
  total_trades: number;
  last_synced_at: string | null;
  source: string;
  message: string;
}

export interface BrokerTrade {
  tradeId: string;
  symbol: string;
  buyingQuantity: number;
  buyingPrice: number;
  sellPrice: number | null;
  netPL: number;
  entryDate: string;
  exitDate: string | null;
  longOrShort: "long" | "short";
  remark?: string | null;
  commission?: number;
  swap?: number;
  status: "open" | "closed";
}

export interface JournalTradesResponse {
  connection_id: string;
  last_synced_at: string | null;
  trades: BrokerTrade[];
}

export interface BrokerConnectPayload {
  broker: string;
  login?: number;
  password?: string;
  server?: string;
  api_key?: string;
  api_secret?: string;
  passphrase?: string;
  market_type?: "spot" | "futures";
  symbols?: string[];
}

export interface StoredBrokerConnection {
  connection_id: string;
  broker_id: string;
  broker_name: string;
  account_number: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  connected_at: string;
  last_synced_at?: string | null;
}
