"use client";

import { useContext, type ReactNode } from "react";

import {
  TradeFixAssistantContext,
  TradeFixAssistantProvider,
  useTradeFixAssistant,
} from "@/components/tradefix-ai/assistant/TradeFixAssistantProvider";

export function TradeFizAgentProvider({ children }: { children: ReactNode }) {
  const existing = useContext(TradeFixAssistantContext);
  if (existing) return children;
  return <TradeFixAssistantProvider>{children}</TradeFixAssistantProvider>;
}

export function useTradeFizAgent() {
  return useTradeFixAssistant();
}
