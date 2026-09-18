import type { MoneyFormatter, ReportValueType } from "@/lib/reports/types";

export function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rem = mins % 60;
  if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function formatDurationLong(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  if (!rem) return hourPart;
  return `${hourPart}, ${rem} minute${rem === 1 ? "" : "s"}`;
}

export function formatAxisCurrency(n: number, formatMoney: MoneyFormatter): string {
  const rounded = Math.round(n);
  if (n < 0) return formatMoney(rounded, { signed: true, digits: 0 });
  return formatMoney(rounded, { signed: false, digits: 0 });
}

export function formatMetricValue(
  value: number,
  valueType: ReportValueType,
  formatMoney: MoneyFormatter
): string {
  switch (valueType) {
    case "currency":
      return value < 0
        ? formatMoney(value, { signed: true, digits: 2 })
        : formatMoney(value, { signed: false, digits: 2 });
    case "duration":
      return formatDurationMinutes(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "ratio":
      return value.toFixed(2);
    case "count":
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    default:
      return String(value);
  }
}

export function formatRMultiple(value: number): string {
  const rounded = Number(value.toFixed(2));
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text}R`;
}

export function formatAxisValue(
  value: number,
  valueType: ReportValueType,
  formatMoney: MoneyFormatter
): string {
  switch (valueType) {
    case "currency":
      return formatAxisCurrency(value, formatMoney);
    case "duration":
      return formatDurationMinutes(value);
    case "percent":
      return `${Math.round(value)}%`;
    case "ratio":
      return value.toFixed(1);
    case "count": {
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    default:
      return String(value);
  }
}
