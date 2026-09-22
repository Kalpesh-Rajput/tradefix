"use client";

import { Suspense } from "react";

import { TradesLogPage } from "@/components/trades/TradesLogPage";
import { Skeleton } from "@/components/ui/Skeleton";

function TradesFallback() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-10 rounded-[10px]" />
      <Skeleton className="h-[420px] rounded-[10px]" />
    </div>
  );
}

export default function TradesPage() {
  return (
    <Suspense fallback={<TradesFallback />}>
      <TradesLogPage />
    </Suspense>
  );
}
