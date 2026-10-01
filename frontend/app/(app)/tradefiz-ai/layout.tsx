"use client";

import type { ReactNode } from "react";

import { TradeFizAgentProvider } from "@/components/tradefiz-ai/agent/TradeFizAgentProvider";

export default function TradeFizLayout({ children }: { children: ReactNode }) {
  return <TradeFizAgentProvider>{children}</TradeFizAgentProvider>;
}
