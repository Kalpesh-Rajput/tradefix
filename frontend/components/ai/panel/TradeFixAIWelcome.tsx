"use client";

import { motion, useReducedMotion } from "framer-motion";

import { TradeFixAIActionButtons } from "@/components/ai/panel/TradeFixAIActionButtons";
import { TradeFixAIQuickActions } from "@/components/ai/panel/TradeFixAIQuickActions";
import { useAuth } from "@/components/providers/AuthProvider";
import { firstName } from "@/lib/format";

export function TradeFixAIWelcome({ source = "Journal" }: { source?: string }) {
  const { user } = useAuth();
  const name = firstName(user?.name, user?.email);
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-5"
    >
      <div>
        <h3 className="text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Hey {name} <span aria-hidden>👋</span>
        </h3>
        <p className="mt-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">
          I&apos;m TradeFix AI. I don&apos;t just analyze your trades — I can help you understand your performance, find
          patterns, and improve your trading process.
        </p>
        <p className="mt-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">
          You can ask me anything about your trading.
        </p>
      </div>

      <p className="text-[12px] text-[var(--color-text-tertiary)]">
        Opened from: <span className="font-medium text-[var(--color-text-secondary)]">{source}</span>
      </p>

      <TradeFixAIQuickActions />
      <TradeFixAIActionButtons />
    </motion.div>
  );
}
