"use client";

import { BarChart3, Brain, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { AiMark } from "@/components/ai/AiMark";
import { thinkingStages, type ThinkingStage } from "@/components/ai/thinking";

const ICONS = {
  sparkle: Sparkles,
  chart: BarChart3,
  search: Search,
  brain: Brain,
} as const;

export function ThinkingIndicator({ question }: { question: string }) {
  const stages = thinkingStages(question);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (stages.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => Math.min(current + 1, stages.length - 1));
    }, 1800);
    return () => window.clearInterval(id);
  }, [question, stages.length]);

  const stage: ThinkingStage = stages[Math.min(index, stages.length - 1)];
  const Icon = ICONS[stage.icon];

  return (
    <div className="flex gap-2.5" role="status" aria-live="polite">
      <AiMark size={28} pulse className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">TradeFix AI</p>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
          <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
          <span>{stage.label}</span>
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="ai-thinking-dot h-1 w-1 rounded-full bg-primary" />
            <span className="ai-thinking-dot h-1 w-1 rounded-full bg-primary" />
            <span className="ai-thinking-dot h-1 w-1 rounded-full bg-primary" />
          </span>
        </p>
      </div>
    </div>
  );
}
