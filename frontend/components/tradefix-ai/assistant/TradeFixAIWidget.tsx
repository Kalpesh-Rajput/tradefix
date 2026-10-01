"use client";

import { AnimatePresence } from "framer-motion";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";
import { TradeFixAILauncher } from "./TradeFixAILauncher";
import { TradeFixAIWindow } from "./TradeFixAIWindow";

export function TradeFixAIWidget() {
  const { open } = useTradeFixAssistant();

  return (
    <>
      <AnimatePresence>{open ? <TradeFixAIWindow key="tradefix-ai-window" /> : null}</AnimatePresence>
      <TradeFixAILauncher />
    </>
  );
}
