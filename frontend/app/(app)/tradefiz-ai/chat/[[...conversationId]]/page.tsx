"use client";

import { Suspense } from "react";

import { TradeFizAgentWorkspace } from "@/components/tradefiz-ai/agent/TradeFizAgentWorkspace";

export default function TradeFizAgentPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={null}>
        <TradeFizAgentWorkspace />
      </Suspense>
    </div>
  );
}
