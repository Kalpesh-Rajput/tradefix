import { addDays, localIso, parseLocalIso } from "@/lib/dateLocal";

export const MY_DAY_PATH = "/my-day";

export type MyDayPhase = "planning" | "trading" | "review";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseMyDayDate(raw: string | null | undefined, today: string): string {
  if (raw && DATE_RE.test(raw)) return raw;
  return today;
}

export function parseMyDayPhase(raw: string | null | undefined): MyDayPhase {
  if (raw === "trading" || raw === "review") return raw;
  return "planning";
}

export function myDayHref(date: string, phase?: MyDayPhase) {
  const params = new URLSearchParams({ date });
  if (phase && phase !== "planning") params.set("phase", phase);
  return `${MY_DAY_PATH}?${params.toString()}`;
}

export function shiftMyDayDate(iso: string, days: number) {
  return localIso(addDays(parseLocalIso(iso), days));
}

/** Furthest date the trader can open from the dashboard picker / My Day arrows. */
export function maxPlannableMyDay(today: string, daysAhead = 30) {
  return shiftMyDayDate(today, daysAhead);
}

export function formatMyDayHeading(iso: string, locale: string) {
  return parseLocalIso(iso).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export type DayPlanImpact = "high" | "medium" | "low";

export type DayPlanItem = {
  id: string;
  label: string;
  done: boolean;
  sort_order: number;
  created_at: string;
};

export type DayPlanEvent = {
  id: string;
  title: string;
  note: string | null;
  occurs_on: string;
  impact: DayPlanImpact;
  sort_order: number;
  created_at: string;
};

export type DayPlan = {
  id: string;
  account_id: string;
  date: string;
  briefing: string;
  items: DayPlanItem[];
  events: DayPlanEvent[];
  created_at: string;
  updated_at: string;
};
