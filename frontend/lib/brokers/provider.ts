/** Types and presentation helpers for GET /api/brokers. The provider list itself stays on the server. */

export interface ProviderField {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
  help: string;
  placeholder: string;
  options: string[];
  type: string;
}

export interface BrokerProvider {
  id: string;
  name: string;
  display_name: string;
  category: string;
  aliases: string[];
  description: string;
  auth_type: string;
  methods: string[];
  capabilities: Record<string, string>;
  badges: string[];
  fields: ProviderField[];
  instructions: Record<string, string[]>;
  limitations: string[];
  docs_url: string;
  regions: string[];
  environments: string[];
  popular: boolean;
  file_formats: string[];
  parser_id: string | null;
  logo: string | null;
  capability_flags?: {
    historical_trades?: boolean;
    realtime?: boolean;
    positions?: boolean;
    orders?: boolean;
    balances?: boolean;
    oauth?: boolean;
    terminal_bridge?: boolean;
    file_import?: boolean;
  };
}

export interface ProviderCatalog {
  brokers: BrokerProvider[];
}

const CATEGORY_LABEL: Record<string, string> = {
  forex: "Forex",
  crypto: "Crypto",
  stocks: "Stocks",
  futures: "Futures",
  prop: "Prop Firms",
  prop_firm: "Prop Firms",
  platform: "Trading Platforms",
};

const CATEGORY_ORDER = ["forex", "crypto", "stocks", "futures", "prop", "prop_firm", "platform"];

const INSTRUCTION_TITLE: Record<string, string> = {
  what_you_need: "What You'll Need",
  steps: "Steps",
  permissions: "Permissions",
  security: "Security",
  what_we_sync: "What TradeFix Syncs",
  limitations: "Limitations",
  troubleshooting: "Troubleshooting",
};

const PRESET_LABEL: Record<string, string> = {
  "7d": "Last 1 Week",
  "30d": "Last 1 Month",
  "90d": "Last 3 Months",
  "180d": "Last 6 Months",
  "365d": "Last 1 Year",
  custom: "Custom",
};

const METHOD_LABEL: Record<string, string> = {
  broker_sync: "Broker Sync",
  file_import: "File Import",
  manual: "Add Trade Manually",
};

/** Favicon host keyed by provider id. Used only when the registry logo is null. */
const LOGO_HOST: Record<string, string> = {
  mt5: "metatrader5.com",
  mt4: "metatrader4.com",
  xm: "xm.com",
  exness: "exness.com",
  avatrade: "avatrade.com",
  ctrader: "ctrader.com",
  xtb: "xtb.com",
  binance: "binance.com",
  bybit: "bybit.com",
  bitget: "bitget.com",
  okx: "okx.com",
  delta: "delta.exchange",
  zerodha: "zerodha.com",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replaceAll("_", " ");
}

export function instructionTitle(key: string): string {
  return INSTRUCTION_TITLE[key] ?? key.replaceAll("_", " ");
}

export function presetLabel(value: string): string {
  return PRESET_LABEL[value] ?? value;
}

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method.replaceAll("_", " ");
}

export function providerLogoUrl(provider: Pick<BrokerProvider, "id" | "logo">): string | null {
  if (provider.logo) return provider.logo;
  const host = LOGO_HOST[provider.id];
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export function orderedCategories(providers: BrokerProvider[]): string[] {
  const present = new Set(providers.map((provider) => provider.category));
  const known = CATEGORY_ORDER.filter((category) => present.has(category));
  const extra = [...present].filter((category) => !CATEGORY_ORDER.includes(category)).sort();
  return [...known, ...extra];
}

export function filterProviders(providers: BrokerProvider[], query: string, category: string): BrokerProvider[] {
  const raw = query.trim().toLowerCase();
  return providers.filter((provider) => {
    if (category !== "all" && provider.category !== category) return false;
    if (!raw) return true;
    const haystack = [
      provider.display_name,
      provider.name,
      provider.id,
      provider.category,
      categoryLabel(provider.category),
      provider.description,
      ...provider.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(raw);
  });
}

export function findProvider(providers: BrokerProvider[], idOrName: string | null | undefined): BrokerProvider | null {
  const needle = (idOrName ?? "").trim().toLowerCase();
  if (!needle) return null;
  return (
    providers.find((provider) => provider.id === needle) ??
    providers.find((provider) => provider.display_name.toLowerCase() === needle || provider.name.toLowerCase() === needle) ??
    providers.find((provider) => provider.aliases.some((alias) => alias.toLowerCase() === needle)) ??
    null
  );
}

export function acceptsFile(provider: BrokerProvider): string {
  const formats = provider.file_formats.length > 0 ? provider.file_formats : ["csv"];
  const extensions = new Set<string>();
  for (const format of formats) {
    if (format.includes("html")) {
      extensions.add(".html");
      extensions.add(".htm");
    } else if (format.includes("xlsx")) {
      extensions.add(".xlsx");
    } else {
      extensions.add(".csv");
    }
  }
  return [...extensions].join(",");
}
