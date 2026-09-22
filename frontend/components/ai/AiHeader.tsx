"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";

import { AiMark } from "@/components/ai/AiMark";

export function AiHeader({
  compact = false,
  pending = false,
  pendingLabel = "Thinking",
}: {
  compact?: boolean;
  pending?: boolean;
  pendingLabel?: string;
}) {
  const reduce = useReducedMotion();
  const enter = reduce
    ? undefined
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22 } };

  return (
    <motion.header {...enter} className={clsx("shrink-0", compact ? "mb-4" : "mb-6")}>
      <div className="flex items-start gap-3">
        <AiMark size={compact ? 32 : 40} pulse={pending} />
        <div className="min-w-0 pt-0.5">
          <p className={clsx("font-semibold tracking-tight text-[var(--color-text-primary)]", compact ? "text-[17px]" : "text-[22px] leading-7 sm:text-[26px]")}>
            TradeFix AI
          </p>
          {compact ? (
            <p className="mt-0.5 text-[12px] text-[var(--color-text-tertiary)]">Your Personal Trading Intelligence</p>
          ) : (
            <>
              <p className="mt-1 text-[15px] font-medium text-[var(--color-text-secondary)]">
                Your trading data. Your patterns. Your edge.
              </p>
              <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--color-text-tertiary)]">
                Ask questions about your trades, journal, setups, performance, and trading habits.
              </p>
            </>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                pending ? "bg-primary ai-status-dot" : "bg-primary"
              )}
              aria-hidden
            />
            <span>{pending ? pendingLabel : "AI Ready"}</span>
          </p>
        </div>
      </div>
    </motion.header>
  );
}
