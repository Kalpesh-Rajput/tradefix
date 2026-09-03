/** One-time broker API credentials from sign-in (same browser session only). */

const KEY = "tradefix_connectors_bootstrap";

export function stashConnectorsBootstrap(email: string, password: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify({ email: email.toLowerCase(), password }));
}

export function peekConnectorsBootstrap(): { email: string; password: string } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { email?: string; password?: string };
    if (!parsed.email || !parsed.password) return null;
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

export function clearConnectorsBootstrap(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
