"use client";

import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { DailyDistributionCard } from "./performance/DailyDistributionCard";
import { DrawdownEpisodes } from "./performance/DrawdownEpisodes";
import { EquityCard } from "./performance/EquityCard";
import { MonthlyReturns } from "./performance/MonthlyReturns";

export function PerformanceSection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <EquityCard data={data} formatMoney={formatMoney} />
        </div>
        <div className="lg:col-span-4">
          <DrawdownEpisodes data={data} formatMoney={formatMoney} />
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <MonthlyReturns data={data} formatMoney={formatMoney} />
        </div>
        <div className="lg:col-span-4">
          <DailyDistributionCard data={data} formatMoney={formatMoney} />
        </div>
      </div>
    </div>
  );
}
