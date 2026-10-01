"use client";

import { createContext, useMemo, type ReactNode } from "react";

import { AskTradeFixAI } from "@/components/tradefix-ai/assistant/AskTradeFixAI";

type AskFn = (question: string) => void;

const TradeFizAskContext = createContext<AskFn | null>(null);

export function TradeFizAskProvider({ ask, children }: { ask: AskFn; children: ReactNode }) {
  const value = useMemo(() => ask, [ask]);
  return <TradeFizAskContext.Provider value={value}>{children}</TradeFizAskContext.Provider>;
}

export function AskTradeFiz({
  question,
  className,
  children,
}: {
  question: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AskTradeFixAI question={question} className={className}>
      {children}
    </AskTradeFixAI>
  );
}
