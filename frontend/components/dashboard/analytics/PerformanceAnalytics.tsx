"use client";

import type { DashboardPerformance } from "@/lib/types";
import { useLocale } from "@/components/providers/LocaleProvider";

import { ActivityHeatmap } from "./ActivityHeatmap";
import { DurationPnlChart } from "./DurationPnlChart";
import { HourlyTradingFrequencyChart } from "./HourlyTradingFrequencyChart";
import { HourlyWinRateChart } from "./HourlyWinRateChart";
import { ProfitByMonthChart } from "./ProfitByMonthChart";
import { RuleDiscipline } from "./RuleDiscipline";
import { SectionLabel, type MoneyFormat } from "./shared";
import { StrategyPerformance } from "./StrategyPerformance";
import { TopSymbols } from "./TopSymbols";
import { TradingInsights } from "./TradingInsights";
import { WeeklyFrequencyChart } from "./WeeklyFrequencyChart";
import { WeeklyWinRateChart } from "./WeeklyWinRateChart";
import { YearlyPerformance } from "./YearlyPerformance";

export function PerformanceAnalytics({
  data,
  formatMoney,
  currencySymbol,
}: {
  data: DashboardPerformance | null | undefined;
  formatMoney: MoneyFormat;
  currencySymbol: string;
}) {
  const { t } = useLocale();
  if (!data) return null;

  return (
    <div className="min-w-0 space-y-3">
      <SectionLabel>{t("dashboard.section.performance")}</SectionLabel>
      <YearlyPerformance data={data} formatMoney={formatMoney} currencySymbol={currencySymbol} />
      <div className="dash-triple">
        <WeeklyWinRateChart data={data} formatMoney={formatMoney} />
        <DurationPnlChart data={data} formatMoney={formatMoney} />
        <WeeklyFrequencyChart data={data} formatMoney={formatMoney} />
      </div>

      <SectionLabel>{t("dashboard.section.time")}</SectionLabel>
      <div className="dash-time">
        <HourlyWinRateChart data={data} formatMoney={formatMoney} />
        <HourlyTradingFrequencyChart data={data} formatMoney={formatMoney} />
        <ProfitByMonthChart data={data} formatMoney={formatMoney} />
      </div>

      <SectionLabel>{t("dashboard.section.activity")}</SectionLabel>
      <ActivityHeatmap data={data} formatMoney={formatMoney} />

      <SectionLabel>{t("dashboard.section.strategy")}</SectionLabel>
      <div className="dash-trio">
        <div className="dash-trio-side dash-trio-symbol">
          <TopSymbols data={data} currencySymbol={currencySymbol} formatMoney={formatMoney} />
        </div>
        <StrategyPerformance data={data} formatMoney={formatMoney} currencySymbol={currencySymbol} />
        <RuleDiscipline data={data} />
      </div>

      <SectionLabel>{t("dashboard.section.insights")}</SectionLabel>
      <TradingInsights data={data} currencySymbol={currencySymbol} formatMoney={formatMoney} />
    </div>
  );
}
