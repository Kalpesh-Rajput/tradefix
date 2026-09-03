import { api } from "@/lib/api";
import { addImportedBrokerTradeIds, getImportedBrokerTradeIds } from "@/lib/connectors/storage";
import type { BrokerTrade } from "@/lib/connectors/types";
import type { AssetType, Trade, TradeInput, TradeSide } from "@/lib/types";

const BROKER_TAG_PREFIX = "[broker:";

function inferAssetType(symbol: string): AssetType {
  const s = symbol.toUpperCase();
  if (s.includes("USDT") || s.includes("USDC") || s.includes("BTC") || s.includes("ETH")) return "crypto";
  if (s.length === 6 && /^[A-Z]{6}$/.test(s)) return "forex";
  if (s.includes("/")) return "forex";
  return "forex";
}

function brokerTag(tradeId: string): string {
  return `${BROKER_TAG_PREFIX}${tradeId}]`;
}

export function tradeHasBrokerTag(trade: Trade, tradeId: string): boolean {
  const tag = brokerTag(tradeId);
  if (trade.notes?.includes(tag)) return true;
  return getImportedBrokerTradeIds().has(tradeId);
}

function mapBrokerTrade(trade: BrokerTrade, accountId: string): TradeInput {
  const side: TradeSide = trade.longOrShort === "short" ? "short" : "long";
  const fees = Math.abs(Number(trade.commission ?? 0)) + Math.abs(Number(trade.swap ?? 0));

  return {
    account_id: accountId,
    symbol: trade.symbol,
    asset_type: inferAssetType(trade.symbol),
    side,
    quantity: trade.buyingQuantity,
    entry_price: trade.buyingPrice,
    exit_price: trade.sellPrice,
    opened_at: trade.entryDate,
    closed_at: trade.exitDate,
    fees,
    status: trade.status,
    notes: trade.remark ? `${trade.remark}\n${brokerTag(trade.tradeId)}` : brokerTag(trade.tradeId),
  };
}

export interface ImportBrokerTradesResult {
  imported: number;
  skipped: number;
  failed: number;
}

export async function importBrokerTradesToJournal(
  brokerTrades: BrokerTrade[],
  accountId: string
): Promise<ImportBrokerTradesResult> {
  const existing = await api.get<Trade[]>(`/api/trades?account_id=${encodeURIComponent(accountId)}&limit=5000`);
  const importedIds = getImportedBrokerTradeIds();

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const newIds: string[] = [];

  for (const trade of brokerTrades) {
    if (importedIds.has(trade.tradeId) || existing.some((t) => tradeHasBrokerTag(t, trade.tradeId))) {
      skipped += 1;
      continue;
    }

    try {
      await api.post<Trade>("/api/trades", mapBrokerTrade(trade, accountId));
      newIds.push(trade.tradeId);
      imported += 1;
    } catch {
      failed += 1;
    }
  }

  if (newIds.length) addImportedBrokerTradeIds(newIds);

  return { imported, skipped, failed };
}
