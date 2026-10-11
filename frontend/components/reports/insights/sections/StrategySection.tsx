"use client";

import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { Leaderboard } from "./strategy/Leaderboard";
import { LongShortCard, SymbolParetoCard } from "./strategy/SideAndSymbols";

export function StrategySection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <Leaderboard data={data} formatMoney={formatMoney} />
        </div>
        <div className="lg:col-span-4">
          <LongShortCard data={data} formatMoney={formatMoney} />
        </div>
      </div>
      <SymbolParetoCard data={data} formatMoney={formatMoney} />
    </div>
  );
}
