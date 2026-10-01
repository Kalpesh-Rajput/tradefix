"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { chatHref } from "@/lib/ai-insights/links";

import { useTradeFixAssistantOptional } from "./TradeFixAssistantProvider";

export function AskTradeFixAI({
  question,
  className,
  children,
}: {
  question: string;
  className?: string;
  children: ReactNode;
}) {
  const assistant = useTradeFixAssistantOptional();
  if (!assistant) {
    return (
      <Link href={chatHref(question)} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={() => assistant.openAndAsk(question)}>
      {children}
    </button>
  );
}
