import { addDays, localIso, parseLocalIso, shortMonth, startOfWeekSunday } from "@/lib/dateLocal";
import type {
  HeatmapCell,
  ProgressSettings,
  ProgressSettingsPayload,
  ProgressSummary,
  RuleAnalytics,
  RuleResult,
  Weekday,
} from "@/lib/progress-tracker/types";

/** Light to deep brand purple. Empty days stay gray so a 0% day is still visible. */
export const DISCIPLINE_LEVELS = ["#E6DDF5", "#CDB8EA", "#A78BCC", "#7A5EAE", "#5B4696"] as const;

const WEEKDAY_SET: Weekday[] = ["mon", "tue", "wed", "thu", "fri"];

export function isoDay(value: string): string {
  return value.slice(0, 10);
}

export function rulesAreActive(settings: ProgressSettings | undefined): boolean {
  if (!settings) return false;
  return (
    settings.trading_hours_enabled ||
    settings.start_day_enabled ||
    settings.link_playbook_enabled ||
    settings.stop_loss_required ||
    settings.max_loss_per_trade_enabled ||
    settings.max_loss_per_day_enabled ||
    settings.manual_rules.some((rule) => rule.is_active && rule.name.trim())
  );
}

export function recommendedSettings(settings: ProgressSettings): ProgressSettingsPayload {
  let start = settings.trading_start_time || "09:30";
  let end = settings.trading_end_time || "16:00";
  if (start === end) {
    start = "09:30";
    end = "16:00";
  }
  const existing = settings.manual_rules.filter((rule) => rule.name.trim());
  const manual_rules =
    existing.length > 0
      ? existing.map((rule, index) => ({
          id: rule.id,
          name: rule.name.trim(),
          schedule: rule.schedule,
          sort_order: index,
          is_active: rule.is_active,
        }))
      : [
          {
            name: "Reviewed the plan before the open",
            schedule: WEEKDAY_SET,
            sort_order: 0,
            is_active: true,
          },
          {
            name: "Journaled the session",
            schedule: WEEKDAY_SET,
            sort_order: 1,
            is_active: true,
          },
        ];

  return {
    active_days: settings.active_days.length ? settings.active_days : WEEKDAY_SET,
    reminder_enabled: settings.reminder_enabled,
    reminder_time: settings.reminder_time || "20:15",
    trading_hours_enabled: true,
    trading_start_time: start,
    trading_end_time: end,
    start_day_enabled: true,
    start_day_time: settings.start_day_time || "09:00",
    link_playbook_enabled: true,
    stop_loss_required: true,
    max_loss_per_trade_enabled: settings.max_loss_per_trade_enabled,
    max_loss_per_trade_mode: settings.max_loss_per_trade_mode,
    max_loss_per_trade_value: settings.max_loss_per_trade_value,
    max_loss_per_day_enabled: settings.max_loss_per_day_enabled,
    max_loss_per_day_value: settings.max_loss_per_day_value,
    manual_rules,
  };
}

export function disciplineLevel(cell: HeatmapCell): number {
  if (cell.future || !cell.tracking || !cell.is_trading_day || cell.score == null || cell.total_applicable <= 0) {
    return -1;
  }
  if (cell.score <= 0) return 0;
  if (cell.score < 40) return 1;
  if (cell.score < 70) return 2;
  if (cell.score < 90) return 3;
  return 4;
}

export function heatmapCaption(cell: HeatmapCell): string {
  const day = isoDay(cell.date);
  if (cell.future) return `${day} is upcoming`;
  if (!cell.tracking) return `${day} is before tracking started`;
  if (!cell.is_trading_day) return `${day} is outside your trading days`;
  if (cell.score == null || cell.total_applicable <= 0) return `${day} has no applicable rules`;
  return `${day} · ${cell.passed} of ${cell.total_applicable} rules followed · ${Math.round(cell.score)}%`;
}

export function buildHeatmapWeeks(cells: HeatmapCell[]): {
  weeks: (HeatmapCell | null)[][];
  monthLabels: { col: number; label: string }[];
} {
  if (!cells.length) return { weeks: [], monthLabels: [] };
  const map = new Map(cells.map((cell) => [isoDay(cell.date), cell]));
  const cursor = startOfWeekSunday(parseLocalIso(isoDay(cells[0].date)));
  const end = parseLocalIso(isoDay(cells[cells.length - 1].date));
  const weeks: (HeatmapCell | null)[][] = [];
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  while (cursor <= end || weeks.length === 0) {
    const col: (HeatmapCell | null)[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = localIso(cursor);
      col.push(map.get(iso) ?? null);
      if (i === 0 && cursor.getMonth() !== lastMonth) {
        monthLabels.push({ col: weeks.length, label: shortMonth(cursor) });
        lastMonth = cursor.getMonth();
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(col);
    if (weeks.length > 60) break;
  }
  return { weeks, monthLabels };
}

/** Sunday-start window ending this week, so the dashboard grid is a full rectangle. */
export function rollingDisciplineWindow(weeks = 20): { from: string; to: string } {
  const today = new Date();
  const end = startOfWeekSunday(today);
  end.setDate(end.getDate() + 6);
  const start = addDays(end, -(weeks * 7 - 1));
  return { from: localIso(start), to: localIso(end) };
}

export type DisciplineSnapshot = {
  scoredDays: number;
  cleanDays: number;
  missedDays: number;
  weakest: RuleAnalytics | null;
  nextRule: RuleResult | null;
};

export function disciplineSnapshot(summary: ProgressSummary): DisciplineSnapshot {
  const today = isoDay(summary.today);
  const days = summary.heatmap.filter((cell) => {
    return (
      isoDay(cell.date) <= today &&
      cell.tracking &&
      cell.is_trading_day &&
      !cell.future &&
      cell.score != null &&
      cell.total_applicable > 0
    );
  });
  const weakest =
    [...summary.rules]
      .filter((rule) => rule.follow_rate != null && rule.applicable > 0 && rule.follow_rate < 100)
      .sort((a, b) => (a.follow_rate ?? 0) - (b.follow_rate ?? 0) || b.failed - a.failed)[0] ?? null;
  const nextRule = summary.checklist.rules.find((rule) => rule.status === "pending") ?? null;
  return {
    scoredDays: days.length,
    cleanDays: days.filter((cell) => cell.score === 100).length,
    missedDays: days.filter((cell) => cell.failed > 0).length,
    weakest,
    nextRule,
  };
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
