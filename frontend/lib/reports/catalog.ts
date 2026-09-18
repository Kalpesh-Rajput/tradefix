import type { DimensionKind } from "@/lib/reports/group";

export type AnalyticsReportId =
  | "day-time"
  | "symbols"
  | "risk"
  | "playbooks"
  | "tags"
  | "dte"
  | "wins-vs-losses";

export type ReportsView = "performance" | "overview" | AnalyticsReportId;

export type ReportSubId = string;

export type ReportCardCopy = {
  best: string;
  least: string;
  mostActive: string;
  bestWinRate: string;
};

export type ReportTabDef = {
  id: ReportSubId;
  label: string;
  kind: DimensionKind;
  ranked?: boolean;
  empty?: string;
  cards: ReportCardCopy;
};

export type ReportDef = {
  id: AnalyticsReportId;
  label: string;
  navLabel: string;
  tabs: ReportTabDef[];
  defaultSub: ReportSubId;
  empty: string;
};

export const ANALYTICS_REPORTS: ReportDef[] = [
  {
    id: "day-time",
    label: "Day & Time",
    navLabel: "Reports: Day & Time",
    tabs: [
      {
        id: "days",
        label: "Days",
        kind: "weekday",
        cards: {
          best: "Best performing day",
          least: "Least performing day",
          mostActive: "Most active day",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "months",
        label: "Months",
        kind: "month",
        cards: {
          best: "Best performing month",
          least: "Least performing month",
          mostActive: "Most active month",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "trade-time",
        label: "Trade time",
        kind: "hour",
        cards: {
          best: "Best performing hour",
          least: "Least performing hour",
          mostActive: "Most active hour",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "trade-duration",
        label: "Trade duration",
        kind: "duration",
        cards: {
          best: "Best performing trade duration",
          least: "Least performing trade duration",
          mostActive: "Most active trade duration",
          bestWinRate: "Best win rate",
        },
      },
    ],
    defaultSub: "days",
    empty: "No trading data available for the selected filters.",
  },
  {
    id: "symbols",
    label: "Symbols",
    navLabel: "Reports: Symbols",
    tabs: [
      {
        id: "symbols",
        label: "Symbols",
        kind: "symbol",
        ranked: true,
        cards: {
          best: "Best performing symbol",
          least: "Least performing symbol",
          mostActive: "Most active symbol",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "instruments",
        label: "Instruments",
        kind: "instrument",
        cards: {
          best: "Best performing instrument",
          least: "Least performing instrument",
          mostActive: "Most active instrument",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "prices",
        label: "Prices",
        kind: "price",
        cards: {
          best: "Best performing price range",
          least: "Least performing price range",
          mostActive: "Most active price range",
          bestWinRate: "Best win rate",
        },
      },
    ],
    defaultSub: "symbols",
    empty: "No trading data available for the selected filters.",
  },
  {
    id: "risk",
    label: "Risk",
    navLabel: "Reports: Risk",
    tabs: [
      {
        id: "volumes",
        label: "Volumes",
        kind: "volume",
        cards: {
          best: "Best performing volume",
          least: "Least performing volume",
          mostActive: "Most active volume",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "position-sizes",
        label: "Position sizes",
        kind: "position",
        cards: {
          best: "Best performing position size",
          least: "Least performing position size",
          mostActive: "Most active position size",
          bestWinRate: "Best win rate",
        },
      },
      {
        id: "r-multiples",
        label: "R-multiples",
        kind: "r",
        empty: "No R-multiple data available for the selected filters.",
        cards: {
          best: "Best performing R-multiple",
          least: "Least performing R-multiple",
          mostActive: "Most active R-multiple",
          bestWinRate: "Best win rate",
        },
      },
    ],
    defaultSub: "volumes",
    empty: "No trading data available for the selected filters.",
  },
  {
    id: "playbooks",
    label: "Playbooks",
    navLabel: "Reports: Playbooks",
    tabs: [
      {
        id: "playbooks",
        label: "Playbooks",
        kind: "playbook",
        ranked: true,
        cards: {
          best: "Best performing playbook",
          least: "Least performing playbook",
          mostActive: "Most active playbook",
          bestWinRate: "Best win rate",
        },
      },
    ],
    defaultSub: "playbooks",
    empty: "No playbook data available.",
  },
  {
    id: "tags",
    label: "Tags",
    navLabel: "Reports: Tags",
    tabs: [
      {
        id: "tags",
        label: "Tags",
        kind: "tag",
        ranked: true,
        cards: {
          best: "Best performing tag",
          least: "Least performing tag",
          mostActive: "Most active tag",
          bestWinRate: "Best win rate",
        },
      },
    ],
    defaultSub: "tags",
    empty: "No tagged trades available.",
  },
  {
    id: "dte",
    label: "Options: Days till expiration",
    navLabel: "Reports: Days till expiration",
    tabs: [
      {
        id: "dte",
        label: "Days till expiration",
        kind: "dte",
        cards: {
          best: "Best performing DTE",
          least: "Least performing DTE",
          mostActive: "Most active DTE",
          bestWinRate: "Best win rate",
        },
      },
    ],
    defaultSub: "dte",
    empty: "No options trades available for the selected filters.",
  },
  {
    id: "wins-vs-losses",
    label: "Wins vs Losses",
    navLabel: "Reports: Wins vs Losses",
    tabs: [
      {
        id: "outcome",
        label: "Outcome",
        kind: "outcome",
        cards: {
          best: "Winning trades",
          least: "Losing trades",
          mostActive: "Break-even trades",
          bestWinRate: "Win rate",
        },
      },
    ],
    defaultSub: "outcome",
    empty: "No closed trades available for the selected filters.",
  },
];

export const REPORT_BY_ID = new Map(ANALYTICS_REPORTS.map((r) => [r.id, r]));

export function isAnalyticsReportId(value: string | null | undefined): value is AnalyticsReportId {
  return !!value && REPORT_BY_ID.has(value as AnalyticsReportId);
}

export function parseReportsView(value: string | null | undefined): ReportsView {
  if (value === "overview" || value === "performance") return value;
  if (isAnalyticsReportId(value)) return value;
  return "performance";
}

export function parseReportSub(report: AnalyticsReportId, value: string | null | undefined): ReportSubId {
  const def = REPORT_BY_ID.get(report);
  if (!def) return "days";
  if (value && def.tabs.some((t) => t.id === value)) return value;
  return def.defaultSub;
}

export const TOP_N_OPTIONS = [5, 10, 20, 50] as const;
export const HOUR_BUCKET_OPTIONS = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
] as const;

export function tabDef(report: AnalyticsReportId, sub: ReportSubId): ReportTabDef | undefined {
  return REPORT_BY_ID.get(report)?.tabs.find((t) => t.id === sub);
}

export function parseTopN(value: string | null | undefined): number {
  const n = Number(value);
  return TOP_N_OPTIONS.includes(n as (typeof TOP_N_OPTIONS)[number]) ? n : 10;
}

export function parseHourBucket(value: string | null | undefined): number {
  const n = Number(value);
  return HOUR_BUCKET_OPTIONS.some((o) => o.minutes === n) ? n : 60;
}
