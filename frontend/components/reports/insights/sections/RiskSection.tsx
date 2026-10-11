"use client";

import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { EdgeQualityCard } from "./risk/EdgeQualityCard";
import { MonteCarloCard } from "./risk/MonteCarloCard";
import { AllStatsCard, PlanOutcomeCard, StreaksCard } from "./risk/PlanStreakCards";
import { RDistributionCard } from "./risk/RDistributionCard";

export function RiskSection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <MonteCarloCard data={data} formatMoney={formatMoney} />
        </div>
        <div className="lg:col-span-4">
          <EdgeQualityCard data={data} />
        </div>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
        <RDistributionCard data={data} />
        <PlanOutcomeCard data={data} />
        <StreaksCard data={data} />
      </div>
      <AllStatsCard data={data} formatMoney={(n) => formatMoney(n)} />
    </div>
  );
}
