/** Shared motion timings. Route enters use CSS so the transform does not linger. */

export const PAGE_ENTER_MS = 280;
export const REVEAL_MS = 220;
export const REVEAL_STAGGER_MS = 40;
export const REVEAL_STAGGER_CAP = 8;

const CHAT_WORKSPACE = "/tradefiz-ai/chat";

/**
 * Route key for the page entrance.
 * Query strings and hashes are ignored so filters and tabs do not replay it.
 * TradeFiz chat conversation ids share one workspace page, so they share one key.
 */
export function pageTransitionKey(pathname: string): string {
  const raw = pathname.trim() || "/";
  const withoutHash = raw.split("#")[0] || "/";
  const pathOnly = withoutHash.split("?")[0] || "/";
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const path = normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;

  if (path === CHAT_WORKSPACE || path.startsWith(`${CHAT_WORKSPACE}/`)) {
    return CHAT_WORKSPACE;
  }
  return path;
}
