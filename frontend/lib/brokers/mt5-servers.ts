/** Companies shown after picking MetaTrader 5. */

export const MT5_SERVERS = [
  "AquaFunded Ltd.",
  "Atlas Funded Ltd.",
  "BrightFunded Ltd.",
  "Dominion Funding Limited",
  "Evercrest Funding Ltd.",
  "Exness (CY) Ltd",
  "Exness (KE) Limited",
  "Exness (MU) Ltd",
  "Exness (SC) Ltd",
  "Exness (UK) Ltd",
  "Exness (VG) Ltd",
  "Exness B.V.",
  "Exness Investment Bank Limited",
  "Exness Limited Jordan LLC",
  "Exness Mena Financial Brokers L.L.C",
  "Exness Technologies Ltd",
  "Funded Friday Ltd.",
  "Funded IQ LLC",
  "Funded Trader Markets Ltd.",
  "Funded Trading Plus Ltd.",
  "Funded7 Ltd.",
  "FundedFirm Ltd.",
  "FundedNext Ltd",
  "FundedSquad Ltd.",
  "FundedVerse Ltd.",
  "Fundedelite Ltd.",
  "FunderPro Saint Lucia Ltd.",
  "Funding Traders Group Ltd.",
  "FundingPips Corp",
  "FundingPips Corp (2)",
  "FutureFund Investment Limited",
  "Goat Funded Ltd.",
  "Golden Hen Fund SPC",
  "IC Funded Evaluations Ltd.",
  "Kudo Funded Ltd.",
  "MetaQuotes Ltd.",
  "Moneta Funded Ltd.",
  "NG Funding Ltd.",
  "OFP Funding Ltd.",
  "OneFunded Capital Ltd.",
  "Shark Funded Ltd.",
  "Sure Leverage Funding Ltd.",
  "Vegafunded Ltd.",
  "WeGetFunded Ltd.",
  "XFunded Ltd.",
  "iFunds Ltd.",
] as const;

/** Exact MT5 login-server names (File → Login to Trade Account), keyed by company family. */
const TRADE_SERVER_HINTS: Record<string, string[]> = {
  exness: ["Exness-MT5Real", "Exness-MT5Trial", "Exness-MT5Zero"],
  fundingpips: ["FundingPips2-SIM", "FundingPips-MT5"],
};

function familyKey(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function tradeServerHintsFor(company: string | null | undefined): string[] {
  if (!company) return [];
  const key = familyKey(company);
  for (const [family, hints] of Object.entries(TRADE_SERVER_HINTS)) {
    if (key.includes(family)) return hints;
  }
  return [];
}

/** Prefer a known trade-server name over a legal company name when connecting. */
export function resolveMt5ConnectServer(company: string | null | undefined): string | null {
  if (!company) return null;
  const hints = tradeServerHintsFor(company);
  if (hints.length > 0) return hints[0];
  return company;
}
