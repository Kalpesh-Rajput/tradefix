"use client";

import { motion, useReducedMotion } from "framer-motion";

import { useAuth } from "@/components/providers/AuthProvider";
import { firstName } from "@/lib/format";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";
import { TradeFixAIQuickPrompts } from "./TradeFixAIQuickPrompts";

export function TradeFixAIWelcome() {
  const { user } = useAuth();
  const { pageLabel } = useTradeFixAssistant();
  const name = firstName(user?.name, user?.email);
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.22 }}
      className="flex flex-col gap-4"
    >
      <div>
        <h3 className="text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          Hey{name ? ` ${name}` : ""}!
        </h3>
        <p className="mt-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">
          I&apos;m your trading intelligence assistant. I can analyze your trades, performance, rules, setups, and behavior.
        </p>
      </div>
      <p className="text-[12px] text-[var(--color-text-tertiary)]">
        Opened from: <span className="font-medium text-[var(--color-text-secondary)]">{pageLabel}</span>
      </p>
      <TradeFixAIQuickPrompts />
    </motion.div>
  );
}
