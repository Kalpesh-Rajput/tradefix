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
] as const;

export function isJournalPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return JOURNAL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
