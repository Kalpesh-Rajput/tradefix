import type { AssistantScope } from "@/lib/ai/assistant-scope";

export type AssistantPrompt = {
  id: string;
  label: string;
  question: string;
};

export type AssistantPage = {
  label: string;
  prompts: AssistantPrompt[];
};

const DASHBOARD: AssistantPrompt[] = [
  { id: "hurting", label: "What's hurting my performance?", question: "What's hurting my performance?" },
  { id: "recent", label: "Summarize my recent trades", question: "Summarize my recent trades" },
  { id: "setup", label: "What's my strongest setup?", question: "What's my strongest setup?" },
];

const TRADES: AssistantPrompt[] = [
  { id: "analyze", label: "Analyze my recent trades", question: "Analyze my recent trades" },
  { id: "pattern", label: "Find my biggest losing pattern", question: "Find my biggest losing pattern" },
  { id: "why", label: "Why am I losing these trades?", question: "Why am I losing these trades?" },
];

const REPORTS: AssistantPrompt[] = [
  { id: "explain", label: "Explain my performance", question: "Explain my performance" },
  { id: "leak", label: "Find my biggest performance leak", question: "Find my biggest performance leak" },
  { id: "changed", label: "What changed recently?", question: "What changed recently?" },
];

const PLAYBOOKS: AssistantPrompt[] = [
  { id: "best", label: "Which playbook performs best?", question: "Which playbook performs best?" },
  { id: "review", label: "Which setup should I review?", question: "Which setup should I review?" },
  { id: "compare", label: "Compare my playbooks", question: "Compare my playbooks" },
];

const PORTFOLIO: AssistantPrompt[] = [
  { id: "analyze", label: "Analyze my portfolio performance", question: "Analyze my portfolio performance" },
  { id: "best", label: "Which account is performing best?", question: "Which account is performing best?" },
  { id: "compare", label: "Compare my accounts", question: "Compare my accounts" },
];

const PAGES: { test: (path: string) => boolean; page: AssistantPage }[] = [
  { test: (path) => path === "/today" || path.startsWith("/today/"), page: { label: "Dashboard", prompts: DASHBOARD } },
  { test: (path) => path === "/home" || path.startsWith("/home/"), page: { label: "Home", prompts: DASHBOARD } },
  { test: (path) => path === "/day" || path.startsWith("/day/"), page: { label: "Day View", prompts: [
    { id: "period", label: "Summarize this period", question: "Summarize my trading for the period I'm viewing" },
    { id: "hurting", label: "What's hurting my performance?", question: "What's hurting my performance?" },
    { id: "mistake", label: "Find my biggest mistake", question: "Find my biggest trading mistake" },
  ] } },
  { test: (path) => path === "/trades" || path.startsWith("/trades/"), page: { label: "Trade View", prompts: TRADES } },
  { test: (path) => path === "/analytics" || path.startsWith("/analytics/"), page: { label: "Reports", prompts: REPORTS } },
  { test: (path) => path === "/progress-tracker" || path.startsWith("/progress-tracker/"), page: { label: "Progress Tracker", prompts: [
    { id: "rules", label: "Am I following my rules?", question: "Am I following my trading rules?" },
    { id: "leak", label: "What's my biggest rule leak?", question: "What's my biggest rule leak?" },
    { id: "focus", label: "What should I focus on next?", question: "What should I focus on next?" },
  ] } },
  { test: (path) => path === "/calendar" || path.startsWith("/calendar/"), page: { label: "Calendar", prompts: [
    { id: "days", label: "Which days am I most profitable?", question: "Which days am I most profitable?" },
    { id: "recent", label: "Summarize my recent trading days", question: "Summarize my recent trading days" },
    { id: "worst", label: "Find my worst trading days", question: "Find my worst trading days" },
  ] } },
  { test: (path) => path === "/market-sessions" || path.startsWith("/market-sessions/"), page: { label: "Market Sessions", prompts: [
    { id: "best", label: "Which session am I most profitable in?", question: "Which session am I most profitable in?" },
    { id: "losing", label: "Where am I losing by session?", question: "Where am I losing money by session?" },
    { id: "compare", label: "Compare my session performance", question: "Compare my session performance" },
  ] } },
  {
    test: (path) => path === "/playbooks" || path.startsWith("/playbooks/") || path === "/trading-plan" || path.startsWith("/trading-plan/"),
    page: { label: "Playbooks", prompts: PLAYBOOKS },
  },
  {
    test: (path) =>
      path === "/mindset" || path.startsWith("/mindset/") || path === "/diary" || path.startsWith("/diary/") || path === "/journal" || path.startsWith("/journal/") || path === "/my-day" || path.startsWith("/my-day/"),
    page: { label: "Mindset", prompts: [
      { id: "mindset", label: "How is my mindset affecting results?", question: "How is my mindset affecting my results?" },
      { id: "behavior", label: "Find patterns in my trading behavior", question: "Find patterns in my trading behavior" },
      { id: "next", label: "What should I work on next?", question: "What should I work on next?" },
    ] },
  },
  { test: (path) => path === "/news" || path.startsWith("/news/"), page: { label: "News", prompts: [
    { id: "news", label: "What news should I pay attention to?", question: "What news should I pay attention to?" },
    { id: "events", label: "How might today's events affect my markets?", question: "How might today's events affect my markets?" },
    { id: "summary", label: "Summarize relevant market news", question: "Summarize relevant market news" },
  ] } },
  { test: (path) => path === "/portfolio" || path.startsWith("/portfolio/"), page: { label: "Portfolio", prompts: PORTFOLIO } },
  { test: (path) => path === "/notebook" || path.startsWith("/notebook/"), page: { label: "Notebook", prompts: [
    { id: "notes", label: "Summarize my recent notes", question: "Summarize my recent journal notes" },
    { id: "themes", label: "What themes show up in my journal?", question: "What themes show up in my journal?" },
    { id: "review", label: "What should I review before the next session?", question: "What should I review before the next session?" },
  ] } },
  { test: (path) => path === "/tradefiz-ai" || path.startsWith("/tradefiz-ai/") || path === "/chat" || path.startsWith("/chat/") || path === "/ai-review" || path.startsWith("/ai-review/"), page: { label: "TradeFix AI", prompts: [
    { id: "losing", label: "Where am I losing money?", question: "Where am I losing money?" },
    { id: "win", label: "What's my win rate?", question: "What is my win rate?" },
    { id: "setup", label: "What's my strongest setup?", question: "What's my strongest setup?" },
  ] } },
];

const FALLBACK: AssistantPage = {
  label: "TradeFix",
  prompts: DASHBOARD,
};

export function assistantPage(pathname: string | null | undefined): AssistantPage {
  const path = pathname || "/";
  return PAGES.find((entry) => entry.test(path))?.page ?? FALLBACK;
}

function formatIso(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatViewContext(
  pathname: string | null | undefined,
  portfolio: string | null | undefined,
  scope: AssistantScope
): string {
  const lines = [`Current page: ${assistantPage(pathname).label}`];
  if (portfolio?.trim()) lines.push(`Portfolio: ${portfolio.trim()}`);
  if (scope.dateFrom && scope.dateTo) {
    lines.push(`Date range: ${formatIso(scope.dateFrom)} – ${formatIso(scope.dateTo)}`);
  } else if (scope.dateFrom) {
    lines.push(`From: ${formatIso(scope.dateFrom)}`);
  } else if (scope.dateTo) {
    lines.push(`Through: ${formatIso(scope.dateTo)}`);
  }
  if (scope.detail?.trim()) lines.push(scope.detail.trim());
  return lines.join("\n").slice(0, 500);
}
