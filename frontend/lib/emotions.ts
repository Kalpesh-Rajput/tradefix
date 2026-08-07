import type { User } from "@/lib/types";

export const BUILTIN_EMOTIONS = [
  "Calm/Neutral",
  "Confident",
  "Focused",
  "Patient",
  "Anxious",
  "FOMO",
  "Revenge Trading",
  "Frustrated",
  "Excited",
  "Bored",
  "Overconfident",
  "Fearful",
  "Greedy",
  "Hesitant",
  "Tilted",
] as const;

function orderCatalog(items: string[], order: string[] | null | undefined): string[] {
  if (!order?.length) return items;
  const set = new Set(items);
  const ordered = order.filter((item) => set.has(item));
  const remaining = items.filter((item) => !ordered.includes(item));
  return [...ordered, ...remaining];
}

export function resolveEmotionCatalog(
  user?: Pick<User, "custom_emotion_tags" | "emotion_tag_order"> | null
): string[] {
  const builtin = [...BUILTIN_EMOTIONS];
  const custom = (user?.custom_emotion_tags ?? []).filter(
    (item) => !builtin.some((b) => b.toLowerCase() === item.toLowerCase())
  );
  return orderCatalog([...builtin, ...custom], user?.emotion_tag_order);
}

export function isBuiltinEmotion(label: string): boolean {
  return BUILTIN_EMOTIONS.some((item) => item.toLowerCase() === label.toLowerCase());
}
