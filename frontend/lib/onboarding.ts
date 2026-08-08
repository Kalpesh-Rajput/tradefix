/** Shared onboarding option catalogs + helpers */

export const EXPERIENCE_OPTIONS = [
  { id: "newbie", label: "Newbie", hint: "< 1 year", icon: "/onboarding/exp-newbie.png" },
  { id: "climbing", label: "Climbing Ranks", hint: "1-3 years", icon: "/onboarding/exp-climbing.png" },
  { id: "ninja", label: "Ninja Level", hint: "3-5 years", icon: "/onboarding/exp-ninja.png" },
  { id: "monk", label: "Monk Mode", hint: "5+ years", icon: "/onboarding/exp-monk.png" },
] as const;

export const CAPITAL_OPTIONS = [
  { id: "personal", label: "Personal Capital" },
  { id: "prop", label: "Prop Firm Account" },
  { id: "not_started", label: "I haven't started yet" },
] as const;

export const BROKER_OPTIONS = [
  "Interactive Brokers",
  "TD Ameritrade / Thinkorswim",
  "Robinhood",
  "E-TRADE",
  "Fidelity",
  "Charles Schwab",
  "Webull",
  "TradingView Paper",
  "MetaTrader / Forex broker",
  "Binance",
  "Coinbase",
  "NinjaTrader",
  "Tradovate",
  "Other",
] as const;

export const MARKET_OPTIONS = [
  { id: "stocks", label: "Stocks" },
  { id: "options", label: "Options" },
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "futures", label: "Futures" },
  { id: "cfd", label: "CFD" },
  { id: "other", label: "Other" },
] as const;

export const GOAL_OPTIONS = [
  {
    id: "journal",
    label: "Journal activities",
    description: "Track and document every trade",
  },
  {
    id: "analyze",
    label: "Analyze performance",
    description: "Dive deep into stats and metrics",
  },
  {
    id: "backtest",
    label: "Backtest strategies",
    description: "Test ideas with historical data",
  },
  {
    id: "learn",
    label: "Learn & improve",
    description: "Build discipline with TradeFix insights",
  },
] as const;

export const REFERRAL_OPTIONS = [
  { id: "google", label: "Google search" },
  { id: "ai", label: "AI tools (ChatGPT, etc.)" },
  { id: "x", label: "X" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "reddit", label: "Reddit" },
  { id: "community", label: "Community / Mentorship" },
  { id: "friend", label: "A friend or colleague" },
  { id: "other", label: "Other" },
] as const;

export const REFERRAL_DETAILS: Record<string, { id: string; label: string }[]> = {
  google: [
    { id: "organic", label: "Organic" },
    { id: "ads", label: "Ads" },
    { id: "unknown", label: "I don't know" },
  ],
  ai: [
    { id: "chatgpt", label: "ChatGPT" },
    { id: "grok", label: "Grok" },
    { id: "gemini", label: "Gemini" },
    { id: "claude", label: "Claude" },
    { id: "perplexity", label: "Perplexity" },
  ],
  instagram: [
    { id: "tradefix", label: "TradeFix IG" },
    { id: "affiliate", label: "Affiliate / Creator" },
  ],
  x: [
    { id: "tradefix", label: "TradeFix X" },
    { id: "affiliate", label: "Affiliate / Creator" },
  ],
  tiktok: [
    { id: "tradefix", label: "TradeFix TikTok" },
    { id: "affiliate", label: "Affiliate / Creator" },
  ],
  youtube: [
    { id: "tradefix", label: "TradeFix" },
    { id: "affiliate", label: "Affiliate / Creator" },
  ],
  community: [
    { id: "discord", label: "TradeFix Discord" },
    { id: "affiliate_community", label: "Affiliate Community" },
  ],
};

export function needsReferralDetail(source: string | null | undefined): boolean {
  if (!source) return false;
  if (source === "other") return true;
  return Boolean(REFERRAL_DETAILS[source]);
}

export function isReferralStepValid(source: string | null | undefined, detail: string | null | undefined): boolean {
  if (!source) return false;
  if (source === "other") return Boolean(detail?.trim());
  const opts = REFERRAL_DETAILS[source];
  if (!opts) return true;
  return Boolean(detail && opts.some((o) => o.id === detail));
}

export function postAuthPath(user: { onboarding_completed_at?: string | null } | null): string {
  if (!user) return "/login";
  return user.onboarding_completed_at ? "/today" : "/onboarding";
}
