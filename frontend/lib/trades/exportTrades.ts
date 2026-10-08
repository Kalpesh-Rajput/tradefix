import { api, ApiError } from "@/lib/api";
import type { LocalFilters } from "@/lib/trades/logFilters";
import type { TradeColumnId } from "@/lib/trades/logColumns";

export type ExportFormat = "csv" | "xlsx" | "xml";
export type ExportScope = "filtered" | "all" | "custom";
export type PnlDisplayMode = "net" | "gross";

export function localExportDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function exportFilename(scope: ExportScope, format: ExportFormat, date = new Date()): string {
  const prefix =
    scope === "custom" ? "tradefix_trades_custom" : scope === "filtered" ? "tradefix_trades_filtered" : "tradefix_trades";
  return `${prefix}_${localExportDate(date)}.${format}`;
}

export function tradeExportRequest(
  filters: LocalFilters,
  accountId: string | undefined,
  pnlDisplayMode: PnlDisplayMode,
  scope: ExportScope,
  format?: ExportFormat,
  columns?: TradeColumnId[]
) {
  return {
    ...(format ? { format } : {}),
    ...(scope === "custom" && columns ? { columns } : {}),
    scope,
    pnl_display_mode: pnlDisplayMode,
    filters: {
      account_id: accountId ?? null,
      search: filters.search,
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
      status: filters.status,
      asset_type: filters.asset_type,
      side: filters.side,
      setup_tag: filters.setup_tag,
      symbol: filters.symbol,
      session: filters.session,
      holding: filters.holding,
      pnl: filters.pnl,
      fees: filters.fees,
      risk: filters.risk,
      roi: filters.roi,
      rating: filters.rating,
      r_multiple: filters.r_multiple,
      weekday: filters.weekday,
      mood: filters.mood,
      emotion: filters.emotion,
      journal: filters.journal,
      rules: filters.rules,
      ids: filters.ids,
      auto_flag: filters.auto_flag,
      today: localExportDate(),
    },
  };
}

export async function fetchExportCount(
  filters: LocalFilters,
  accountId: string | undefined,
  pnlDisplayMode: PnlDisplayMode,
  scope: ExportScope
): Promise<number> {
  const result = await api.post<{ count: number }>(
    "/api/trades/export/count",
    tradeExportRequest(filters, accountId, pnlDisplayMode, scope)
  );
  return result.count;
}

export async function downloadTradeExport(
  filters: LocalFilters,
  accountId: string | undefined,
  pnlDisplayMode: PnlDisplayMode,
  scope: ExportScope,
  format: ExportFormat,
  onGenerating?: () => void,
  columns?: TradeColumnId[]
): Promise<void> {
  await api.downloadPost(
    "/api/trades/export",
    tradeExportRequest(filters, accountId, pnlDisplayMode, scope, format, columns),
    exportFilename(scope, format),
    onGenerating
  );
}

export function exportFailureMessage(error: unknown): string {
  if (error instanceof ApiError && error.message === "No trades available to export.") {
    return "No trades available to export.";
  }
  if (error instanceof ApiError && error.status >= 500) {
    return "Export failed. Please try again.";
  }
  return "Unable to export trades. Please try again.";
}
