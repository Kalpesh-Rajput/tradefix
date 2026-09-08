import type { MessageKey } from "@/lib/i18n";

export const JOURNAL_PREFIXES = [
  "/today",
  "/day",
  "/diary",
  "/trades",
  "/analytics",
  "/calendar",
  "/trading-plan",
  "/mindset",
  "/news",
  "/portfolio",
  "/journal",
  "/notebook",
] as const;

export function isJournalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return JOURNAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function pageTitleKey(pathname: string | null | undefined): MessageKey {
  if (!pathname) return "nav.today";
  if (pathname === "/home") return "nav.home";
  if (pathname === "/today" || pathname.startsWith("/today/")) return "nav.today";
  if (pathname === "/day" || pathname.startsWith("/day/")) return "nav.dayView";
  if (pathname === "/diary" || pathname.startsWith("/diary/")) return "nav.journal";
  if (pathname === "/notebook" || pathname.startsWith("/notebook/")) return "nav.notebook";
  if (pathname === "/trades" || pathname.startsWith("/trades/")) return "nav.tradeLog";
  if (pathname === "/analytics" || pathname.startsWith("/analytics/")) return "nav.analytics";
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return "nav.calendar";
  if (pathname === "/trading-plan" || pathname.startsWith("/trading-plan/")) return "nav.tradingPlan";
  if (pathname === "/mindset" || pathname.startsWith("/mindset/")) return "nav.mindset";
  if (pathname === "/news" || pathname.startsWith("/news/")) return "nav.news";
  if (pathname === "/portfolio" || pathname.startsWith("/portfolio/")) return "nav.portfolio";
  if (pathname === "/backtest" || pathname.startsWith("/backtest/")) return "nav.backtesting";
  if (pathname === "/agents" || pathname.startsWith("/agents/")) return "nav.agents";
  if (pathname === "/coach" || pathname.startsWith("/coach/")) return "nav.mentor";
  if (pathname.startsWith("/settings/prop-firm")) return "nav.propFirmSync";
  if (pathname.startsWith("/settings/support")) return "nav.help";
  if (pathname === "/wiki" || pathname.startsWith("/wiki/")) return "nav.university";
  if (pathname === "/perks") return "nav.referral";
  if (pathname.startsWith("/settings")) return "common.settings";
  return "nav.today";
}
