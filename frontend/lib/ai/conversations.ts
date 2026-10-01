import type { ThreadMessage } from "@/components/ai/types";

const STORAGE_PREFIX = "tradefix.ai.conversations.v1";
const DAY_MS = 86_400_000;
const MAX_CONVERSATIONS = 60;

export type StoredConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ThreadMessage[];
};

export const HISTORY_GROUPS = ["Today", "Yesterday", "Previous 7 Days", "Older"] as const;
export type HistoryGroup = (typeof HISTORY_GROUPS)[number];

const scrollTops = new Map<string, number>();

export function rememberScroll(id: string, top: number) {
  if (!id) return;
  scrollTops.set(id, top);
}

export function recallScroll(id: string): number | undefined {
  return scrollTops.get(id);
}

export function conversationTitle(messages: ThreadMessage[]): string {
  const text = messages.find((item) => item.role === "user")?.text.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "New conversation";
  return text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text;
}

function hasQuestion(messages: ThreadMessage[]): boolean {
  return messages.some((item) => item.role === "user" && item.text.trim().length > 0);
}

function isMessage(value: unknown): value is ThreadMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as ThreadMessage;
  return (message.role === "user" || message.role === "assistant") && typeof message.id === "string" && typeof message.text === "string";
}

function isConversation(value: unknown): value is StoredConversation {
  if (!value || typeof value !== "object") return false;
  const item = value as StoredConversation;
  return typeof item.id === "string" && typeof item.createdAt === "number" && typeof item.updatedAt === "number" && Array.isArray(item.messages) && item.messages.every(isMessage);
}

export function loadConversations(userId: string): StoredConversation[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}.${userId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConversation).filter((item) => hasQuestion(item.messages));
  } catch {
    return [];
  }
}

export function saveConversations(userId: string, items: StoredConversation[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}.${userId}`, JSON.stringify(items.slice(0, MAX_CONVERSATIONS)));
  } catch {
    return;
  }
}

export function upsertConversation(items: StoredConversation[], next: StoredConversation): StoredConversation[] {
  const existing = items.find((item) => item.id === next.id);
  const without = items.filter((item) => item.id !== next.id);
  if (!hasQuestion(next.messages)) return without;
  const row: StoredConversation = {
    ...next,
    createdAt: existing?.createdAt ?? next.createdAt,
    title: conversationTitle(next.messages),
    updatedAt: next.updatedAt,
  };
  return [row, ...without].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS);
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function groupConversations(items: StoredConversation[], now = Date.now()): { label: HistoryGroup; items: StoredConversation[] }[] {
  const today = startOfDay(now);
  const yesterday = today - DAY_MS;
  const week = today - 7 * DAY_MS;
  const buckets: Record<HistoryGroup, StoredConversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    Older: [],
  };
  const sorted = [...items].filter((item) => hasQuestion(item.messages)).sort((a, b) => b.updatedAt - a.updatedAt);
  for (const item of sorted) {
    if (item.updatedAt >= today) buckets.Today.push(item);
    else if (item.updatedAt >= yesterday) buckets.Yesterday.push(item);
    else if (item.updatedAt >= week) buckets["Previous 7 Days"].push(item);
    else buckets.Older.push(item);
  }
  return HISTORY_GROUPS.map((label) => ({ label, items: buckets[label] })).filter((group) => group.items.length > 0);
}
