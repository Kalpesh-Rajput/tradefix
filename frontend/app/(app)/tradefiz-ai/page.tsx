"use client";

import { Suspense } from "react";

import { TradeFizAiWorkspace } from "@/components/tradefiz-ai/TradeFizAiWorkspace";

export default function TradeFizAiPage() {
  return (
    <Suspense fallback={null}>
      <TradeFizAiWorkspace />
    </Suspense>
  );
}
