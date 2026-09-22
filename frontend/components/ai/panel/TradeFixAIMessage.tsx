"use client";

import { AssistantMessage, UserMessage } from "@/components/ai/AiMessage";
import type { ThreadMessage } from "@/components/ai/types";

export function TradeFixAIMessage({
  message,
  onEdit,
  onRetry,
  onCopy,
  onRegenerate,
  onReact,
  followUps,
  onFollowUp,
}: {
  message: ThreadMessage;
  onEdit?: () => void;
  onRetry?: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onReact?: (reaction: "up" | "down") => void;
  followUps?: string[];
  onFollowUp?: (question: string) => void;
}) {
  if (message.role === "user") {
    return <UserMessage text={message.text} onEdit={onEdit} appearance="panel" />;
  }
  return (
    <AssistantMessage
      message={message}
      onRetry={onRetry}
      onCopy={onCopy}
      onRegenerate={onRegenerate}
      onReact={onReact}
      followUps={followUps}
      onFollowUp={onFollowUp}
      appearance="panel"
    />
  );
}
