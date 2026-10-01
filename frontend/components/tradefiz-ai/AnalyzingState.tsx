"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const STAGES = [
  "Analyzing performance...",
  "Analyzing rule adherence...",
  "Analyzing setups...",
  "Analyzing losses...",
  "Finding patterns...",
];

export function AnalyzingState() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setStep((current) => (current >= STAGES.length - 1 ? current : current + 1));
    }, 850);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <div className="dash-card flex min-h-[220px] flex-col items-start justify-center px-5 py-8 sm:px-6">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold">TradeFix AI</p>
      </div>
      {reduce ? (
        <p className="mt-3 text-[14px] text-[var(--color-text-secondary)]">Analyzing your trading...</p>
      ) : (
        <div className="mt-4 space-y-1.5" aria-live="polite">
          {STAGES.slice(0, step + 1).map((stage, index) => (
            <p
              key={stage}
              className={
                index === step
                  ? "text-[14px] font-medium text-[var(--color-text-primary)]"
                  : "text-[12px] text-[var(--color-text-tertiary)]"
              }
            >
              {stage}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
