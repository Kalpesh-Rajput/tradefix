import type { DisplayPnlFn, ReportPnlMode } from "@/lib/reports/types";

export const REPORT_PNL_MODES: { id: ReportPnlMode; label: string }[] = [
  { id: "net", label: "NET P&L" },
  { id: "gross", label: "GROSS P&L" },
];

/** Same rule as AccountProvider.displayPnl, but driven by the Overview selector. */
export function displayPnlForMode(mode: ReportPnlMode): DisplayPnlFn {
  return (pnl, fees = 0) => {
    if (pnl == null) return null;
    const n = Number(pnl);
    if (!Number.isFinite(n)) return null;
    if (mode === "gross") return Number((n + Number(fees || 0)).toFixed(2));
    return n;
  };
}

export function formatReportRangeLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "ALL DATES";
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    if (!Number.isFinite(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) return fmt(dateFrom);
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  }
  if (dateFrom) return `From ${fmt(dateFrom)}`;
  return `Until ${fmt(dateTo!)}`;
}
