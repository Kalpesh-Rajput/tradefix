import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";

export function pnlHex(n: number) {
  return n >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX;
}

export function formatNetPnl(
  n: number,
  formatMoney: (value: number, opts?: { signed?: boolean; digits?: number }) => string
) {
  const digits = Math.abs(n) >= 100 && Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  return formatMoney(n, { signed: true, digits }).replace(/^\+/, "");
}
