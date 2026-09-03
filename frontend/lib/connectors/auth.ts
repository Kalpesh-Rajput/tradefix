import { connectorsApi, saveConnectorsLogin } from "@/lib/connectors/api";
import { clearConnectorsBootstrap } from "@/lib/connectors/bootstrap";
import { clearConnectorsSession, getConnectorsAccessToken } from "@/lib/connectors/storage";

export interface ConnectorsAuthResult {
  ok: boolean;
  error?: string;
}

/** Register on Connectors when the web app creates an account. */
export async function registerConnectorsAccount(email: string, password: string): Promise<void> {
  try {
    await connectorsApi.register(email, password);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("already")) return;
    throw err;
  }
}

export async function loginConnectorsWithPassword(email: string, password: string): Promise<ConnectorsAuthResult> {
  try {
    const tokens = await connectorsApi.login(email, password);
    saveConnectorsLogin(tokens);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not sign in to broker API",
    };
  }
}

/**
 * Ensure the user has a Connectors account and an active session.
 * Tries login first; if the account only exists on the web app, registers then logs in.
 */
export async function ensureConnectorsAccount(email: string, password: string): Promise<ConnectorsAuthResult> {
  const first = await loginConnectorsWithPassword(email, password);
  if (first.ok) return first;

  const msg = (first.error ?? "").toLowerCase();
  const missingAccount =
    msg.includes("invalid email") ||
    msg.includes("invalid password") ||
    msg.includes("not found") ||
    msg.includes("401");

  if (!missingAccount) return first;

  try {
    await registerConnectorsAccount(email, password);
  } catch {
    return first;
  }

  return loginConnectorsWithPassword(email, password);
}

export function hasConnectorsSession(): boolean {
  return Boolean(getConnectorsAccessToken());
}

export function logoutConnectors(): void {
  clearConnectorsBootstrap();
  clearConnectorsSession();
}
