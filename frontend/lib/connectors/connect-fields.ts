import type { BrokerCatalogItem, BrokerConnectPayload } from "@/lib/connectors/types";

export type ConnectFieldKey =
  | "login"
  | "password"
  | "server"
  | "api_key"
  | "api_secret"
  | "passphrase"
  | "market_type"
  | "symbols";

export interface ConnectFieldMeta {
  label: string;
  hint?: string;
  placeholder?: string;
  inputMode?: "numeric" | "email" | "text";
  secret?: boolean;
}

export const CUSTOM_SERVER_VALUE = "__custom__";

const MT_BROKERS = new Set(["mt5", "exness"]);
const SYMBOLS_REQUIRED = new Set(["binance", "bybit", "bitget", "okx", "delta"]);
const PASSPHRASE_BROKERS = new Set(["bitget", "okx"]);
const OPTIONAL_SYMBOL_BROKERS = new Set([
  "ctrader",
  "matchtrader",
  "tradovate",
  "ninjatrader",
  "tradeninja",
  "tradingview",
]);
const ENV_SERVER_BROKERS = new Set(["tradovate", "ninjatrader", "tradeninja"]);

const DEFAULT_META: Record<ConnectFieldKey, ConnectFieldMeta> = {
  login: { label: "Login ID", placeholder: "Account login", inputMode: "numeric" },
  password: {
    label: "Password",
    placeholder: "••••••••",
    secret: true,
  },
  server: { label: "Server", placeholder: "Trade server name" },
  api_key: { label: "API key", placeholder: "Read-only API key" },
  api_secret: { label: "API secret", placeholder: "API secret", secret: true },
  passphrase: { label: "Passphrase", placeholder: "API passphrase", secret: true },
  market_type: { label: "Market type" },
  symbols: {
    label: "Symbols",
    hint: "Comma-separated. Example: BTCUSDT, ETHUSDT",
    placeholder: "BTCUSDT, ETHUSDT",
  },
};

const BY_BROKER: Record<string, Partial<Record<ConnectFieldKey, ConnectFieldMeta>>> = {
  mt5: {
    login: { label: "Login ID", placeholder: "MT5 login number", inputMode: "numeric" },
    password: {
      label: "Investor password",
      hint: "Use the read-only investor password, not your trading password.",
      placeholder: "Investor password",
      secret: true,
    },
    server: {
      label: "Server",
      hint: "Pick a hint or type the exact name from MetaTrader 5 → File → Login to Trade Account.",
      placeholder: "Select server",
    },
  },
  exness: {
    login: { label: "Login ID", placeholder: "Exness login number", inputMode: "numeric" },
    password: {
      label: "Investor password",
      hint: "Use the read-only investor password, not your trading password.",
      placeholder: "Investor password",
      secret: true,
    },
    server: {
      label: "Server",
      hint: "Copy the exact name from MetaTrader 5 → File → Login to Trade Account.",
      placeholder: "Exness-MT5Real",
    },
  },
  ctrader: {
    api_key: { label: "Client ID", placeholder: "cTrader client ID" },
    api_secret: { label: "Access token", placeholder: "Access token", secret: true },
  },
  matchtrader: {
    api_key: { label: "Email", placeholder: "Email", inputMode: "email" },
    api_secret: { label: "Password", placeholder: "Password", secret: true },
    server: {
      label: "Broker ID",
      hint: "The MatchTrader brokerId or broker host.",
      placeholder: "Broker ID",
    },
  },
  binance: {
    api_key: { label: "API key", placeholder: "Read-only API key" },
    api_secret: { label: "API secret", placeholder: "API secret", secret: true },
    symbols: {
      label: "Symbols",
      hint: "Required. Example: BTCUSDT, ETHUSDT",
      placeholder: "BTCUSDT, ETHUSDT",
    },
  },
  bybit: {
    api_key: { label: "API key", placeholder: "Read-only API key" },
    api_secret: { label: "API secret", placeholder: "API secret", secret: true },
    symbols: {
      label: "Symbols",
      hint: "Required. Example: BTCUSDT",
      placeholder: "BTCUSDT",
    },
  },
  bitget: {
    api_key: { label: "API key", placeholder: "Read-only API key" },
    api_secret: { label: "API secret", placeholder: "API secret", secret: true },
    passphrase: { label: "Passphrase", placeholder: "API passphrase", secret: true },
    symbols: {
      label: "Symbols",
      hint: "Required. Example: BTCUSDT",
      placeholder: "BTCUSDT",
    },
  },
  okx: {
    api_key: { label: "API key", placeholder: "Read-only API key" },
    api_secret: { label: "API secret", placeholder: "API secret", secret: true },
    passphrase: { label: "Passphrase", placeholder: "API passphrase", secret: true },
    symbols: {
      label: "Symbols",
      hint: "Required. Example: BTC-USDT",
      placeholder: "BTC-USDT",
    },
  },
  delta: {
    api_key: { label: "API key", placeholder: "Read-only API key" },
    api_secret: { label: "API secret", placeholder: "API secret", secret: true },
    symbols: {
      label: "Symbols",
      hint: "Required. Example: BTCUSD",
      placeholder: "BTCUSD",
    },
  },
  tradovate: {
    api_key: { label: "Username", placeholder: "Tradovate username" },
    api_secret: { label: "Password", placeholder: "API password", secret: true },
    server: {
      label: "Environment",
      hint: "Optional. Live is the default if you leave this blank.",
      placeholder: "live or demo",
    },
  },
  ninjatrader: {
    api_key: { label: "Username", placeholder: "Username" },
    api_secret: { label: "Password", placeholder: "API password", secret: true },
    server: {
      label: "Environment",
      hint: "Optional. Live is the default if you leave this blank.",
      placeholder: "live or demo",
    },
  },
  tradeninja: {
    api_key: { label: "Username", placeholder: "Username" },
    api_secret: { label: "Password", placeholder: "API password", secret: true },
    server: {
      label: "Environment",
      hint: "Optional. Live is the default if you leave this blank.",
      placeholder: "live or demo",
    },
  },
  tradingview: {
    api_key: { label: "Username", placeholder: "TradingView username" },
    api_secret: { label: "Webhook secret", placeholder: "Webhook secret", secret: true },
  },
};

export class ConnectPayloadError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "ConnectPayloadError";
    this.field = field;
  }
}

/** Catalog card id — never send `tradeninja` from the picker. */
export function catalogBrokerId(brokerId: string): string {
  return brokerId.toLowerCase() === "tradeninja" ? "ninjatrader" : brokerId;
}

export function isMtFamily(broker: Pick<BrokerCatalogItem, "id" | "kind">): boolean {
  return broker.kind === "mt5" || MT_BROKERS.has(broker.id);
}

export function allowsCustomServer(broker: Pick<BrokerCatalogItem, "id" | "kind">): boolean {
  return isMtFamily(broker);
}

export function isEnvironmentServer(brokerId: string): boolean {
  return ENV_SERVER_BROKERS.has(brokerId);
}

export function connectFieldMeta(broker: BrokerCatalogItem, field: string): ConnectFieldMeta {
  const key = field as ConnectFieldKey;
  return BY_BROKER[broker.id]?.[key] ?? DEFAULT_META[key] ?? { label: field };
}

export function isSecretField(broker: BrokerCatalogItem, field: string): boolean {
  return connectFieldMeta(broker, field).secret === true;
}

/** Catalog fields plus extras the API accepts but catalog omits (Tradovate live/demo). */
export function extraConnectFields(broker: BrokerCatalogItem): ConnectFieldKey[] {
  if (isEnvironmentServer(broker.id) && !broker.fields.includes("server")) {
    return ["server"];
  }
  return [];
}

export function connectFormFields(broker: BrokerCatalogItem): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of [...broker.fields, ...extraConnectFields(broker)]) {
    if (seen.has(field)) continue;
    seen.add(field);
    out.push(field);
  }
  return out;
}

export function isConnectFieldRequired(broker: BrokerCatalogItem, field: string): boolean {
  if (field === "symbols") return SYMBOLS_REQUIRED.has(broker.id);
  if (field === "market_type") return SYMBOLS_REQUIRED.has(broker.id) || PASSPHRASE_BROKERS.has(broker.id);
  if (field === "server") {
    if (isEnvironmentServer(broker.id)) return false;
    if (broker.id === "matchtrader") return true;
    if (isMtFamily(broker)) return true;
    return broker.fields.includes("server");
  }
  return true;
}

export function defaultConnectFields(
  broker: BrokerCatalogItem,
  presetServer?: string | null
): Record<string, string> {
  const fields: Record<string, string> = {};
  if (presetServer?.trim()) fields.server = presetServer.trim();
  if (SYMBOLS_REQUIRED.has(broker.id) || PASSPHRASE_BROKERS.has(broker.id)) {
    fields.market_type = "spot";
  }
  return fields;
}

function requireText(value: string | undefined, message: string, field: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new ConnectPayloadError(message, field);
  return trimmed;
}

function parseSymbols(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function keySecretPayload(
  broker: string,
  values: Record<string, string>,
  label: string
): BrokerConnectPayload {
  return {
    broker,
    api_key: requireText(values.api_key, `${label} API key is required.`, "api_key"),
    api_secret: values.api_secret?.length
      ? values.api_secret
      : (() => {
          throw new ConnectPayloadError(`${label} API secret is required.`, "api_secret");
        })(),
  };
}

/** Build a ConnectRequest body that matches Connectors validators. */
export function buildConnectPayload(
  brokerId: string,
  values: Record<string, string>
): BrokerConnectPayload {
  const broker = catalogBrokerId(brokerId);

  if (MT_BROKERS.has(broker)) {
    const loginRaw = values.login?.trim() ?? "";
    const login = Number(loginRaw);
    if (!loginRaw || !Number.isInteger(login) || login <= 0) {
      throw new ConnectPayloadError("Login must be a positive whole number.", "login");
    }
    const password = values.password ?? "";
    if (!password) throw new ConnectPayloadError("Investor password is required.", "password");
    const server = requireText(values.server, "Server is required.", "server");
    if (server === CUSTOM_SERVER_VALUE) {
      throw new ConnectPayloadError("Enter the exact MT5 server name.", "server");
    }
    return { broker, login, password, server };
  }

  if (PASSPHRASE_BROKERS.has(broker)) {
    const label = broker === "okx" ? "OKX" : "Bitget";
    const payload = keySecretPayload(broker, values, label);
    const passphrase = values.passphrase ?? "";
    if (!passphrase) throw new ConnectPayloadError(`${label} passphrase is required.`, "passphrase");
    const symbols = parseSymbols(values.symbols);
    if (symbols.length === 0) {
      throw new ConnectPayloadError(`${label} requires at least one symbol.`, "symbols");
    }
    payload.passphrase = passphrase;
    payload.symbols = symbols;
    payload.market_type = values.market_type === "futures" ? "futures" : "spot";
    return payload;
  }

  if (SYMBOLS_REQUIRED.has(broker)) {
    const labels: Record<string, string> = {
      binance: "Binance",
      bybit: "Bybit",
      delta: "Delta Exchange",
    };
    const label = labels[broker] ?? broker;
    const payload = keySecretPayload(broker, values, label);
    const symbols = parseSymbols(values.symbols);
    if (symbols.length === 0) {
      throw new ConnectPayloadError(`${label} requires at least one symbol.`, "symbols");
    }
    payload.symbols = symbols;
    payload.market_type = values.market_type === "futures" ? "futures" : "spot";
    return payload;
  }

  if (OPTIONAL_SYMBOL_BROKERS.has(broker)) {
    const labels: Record<string, string> = {
      ctrader: "cTrader",
      matchtrader: "MatchTrader",
      tradovate: "Tradovate",
      ninjatrader: "NinjaTrader",
      tradeninja: "NinjaTrader",
      tradingview: "TradingView",
    };
    const label = labels[broker] ?? broker;
    const payload = keySecretPayload(broker, values, label);
    if (broker === "matchtrader") {
      payload.server = requireText(values.server, "MatchTrader broker ID is required.", "server");
    }
    if (isEnvironmentServer(broker)) {
      const env = values.server?.trim().toLowerCase();
      if (env === "live" || env === "demo") payload.server = env;
    }
    const symbols = parseSymbols(values.symbols);
    if (symbols.length > 0) payload.symbols = symbols;
    return payload;
  }

  throw new ConnectPayloadError(`Unsupported broker: ${broker}`);
}
