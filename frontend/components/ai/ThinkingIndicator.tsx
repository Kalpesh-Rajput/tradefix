"use client";

import { AiMark } from "@/components/ai/AiMark";
import { pendingStatusLabel } from "@/components/ai/thinking";

export function ThinkingIndicator({
  question,
  variant = "default",
}: {
  question: string;
  variant?: "default" | "agent";
}) {
  void variant;
  const label = pendingStatusLabel(question);

  return (
    <div className="flex gap-2.5" role="status" aria-live="polite">
      <AiMark size={28} pulse className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">TradeFix AI</p>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
          <span>{label}</span>
          <span className="inline-flex items-center gap-1" aria-hidden>
            <span className="ai-thinking-dot h-1 w-1 rounded-full bg-primary" />
            <span className="ai-thinking-dot h-1 w-1 rounded-full bg-primary" />
            <span className="ai-thinking-dot h-1 w-1 rounded-full bg-primary" />
          </span>
        </p>
      </div>
    </div>
  );
}
