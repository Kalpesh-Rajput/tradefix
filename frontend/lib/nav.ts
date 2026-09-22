import type { MessageKey } from "@/lib/i18n";

export const APP_HOME = "/home";

export const JOURNAL_PREFIXES = [
  "/today",
  "/day",
  "/my-day",
  "/diary",
  "/trades",
  "/analytics",
  "/progress-tracker",
  "/calendar",
  "/market-sessions",
  "/playbooks",
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

function normalizePath(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "");
  return clean || "/";
}

/** Logical parent for a route when in-app history is empty (refresh, deep link). */
export function parentPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const clean = normalizePath(pathname);
  if (clean === "/" || clean === APP_HOME) return null;

  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === "settings") return APP_HOME;
  if (clean === "/my-day" || clean.startsWith("/my-day/")) return "/today";
  if (parts.length === 1) return APP_HOME;
  return `/${parts.slice(0, -1).join("/")}`;
}

export function pageTitleKey(pathname: string | null | undefined): MessageKey {
  if (!pathname) return "nav.today";
  if (pathname === "/home") return "nav.home";
  if (pathname === "/today" || pathname.startsWith("/today/")) return "nav.today";
  if (pathname === "/day" || pathname.startsWith("/day/")) return "nav.dayView";
  if (pathname === "/my-day" || pathname.startsWith("/my-day/")) return "nav.myDay";
  if (pathname === "/diary" || pathname.startsWith("/diary/")) return "nav.journal";
  if (pathname === "/notebook" || pathname.startsWith("/notebook/")) return "nav.notebook";
  if (pathname === "/trades" || pathname.startsWith("/trades/")) return "nav.tradeLog";
  if (pathname === "/analytics" || pathname.startsWith("/analytics/")) return "nav.analytics";
  if (pathname === "/progress-tracker" || pathname.startsWith("/progress-tracker/")) return "nav.progressTracker";
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) return "nav.calendar";
  if (pathname === "/market-sessions" || pathname.startsWith("/market-sessions/")) return "nav.marketSessions";
  if (pathname === "/playbooks" || pathname.startsWith("/playbooks/")) return "nav.tradingPlan";
  if (pathname === "/trading-plan" || pathname.startsWith("/trading-plan/")) return "nav.tradingPlan";
  if (pathname === "/mindset" || pathname.startsWith("/mindset/")) return "nav.mindset";
  if (pathname === "/news" || pathname.startsWith("/news/")) return "nav.news";
  if (pathname === "/portfolio" || pathname.startsWith("/portfolio/")) return "nav.portfolio";
  if (pathname === "/backtest" || pathname.startsWith("/backtest/")) return "nav.backtesting";
  if (pathname === "/agents" || pathname.startsWith("/agents/")) return "nav.agents";
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return "nav.maxAi";
  if (pathname === "/coach" || pathname.startsWith("/coach/")) return "nav.mentor";
  if (pathname.startsWith("/settings/prop-firm")) return "nav.propFirmSync";
  if (pathname.startsWith("/settings/support")) return "nav.help";
  if (pathname === "/wiki" || pathname.startsWith("/wiki/")) return "nav.university";
  if (pathname === "/perks") return "nav.referral";
  if (pathname.startsWith("/settings")) return "common.settings";
  return "nav.today";
}
