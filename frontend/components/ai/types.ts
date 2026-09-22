import type { AiSource } from "@/lib/types";

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: string[];
  sources?: AiSource[];
  error?: boolean;
  reaction?: "up" | "down";
};
