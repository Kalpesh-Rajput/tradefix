"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { useAdvancedAnalytics } from "@/lib/hooks/useAdvancedAnalytics";
import type { AdvancedFilters } from "@/lib/reports/advanced/query";
import type { MoneyFormatter, ReportPnlMode } from "@/lib/reports/types";

import { DrillProvider } from "./DrillContext";
import { DisciplineSection } from "./sections/DisciplineSection";
import { ExecutiveSection } from "./sections/ExecutiveSection";
import { FindingsSection } from "./sections/FindingsSection";
import { PerformanceSection } from "./sections/PerformanceSection";
import { PsychologySection } from "./sections/PsychologySection";
import { RiskSection } from "./sections/RiskSection";
import { StrategySection } from "./sections/StrategySection";
import { TimingSection } from "./sections/TimingSection";
import { InsightSection, SectionNav, type InsightSectionDef } from "./ui/Section";
import { Segmented } from "./ui/Segmented";

const SECTIONS: InsightSectionDef[] = [
  { id: "summary", label: "Summary" },
  { id: "findings", label: "Findings" },
  { id: "performance", label: "Performance" },
  { id: "risk", label: "Risk" },
  { id: "timing", label: "Timing" },
  { id: "strategy", label: "Strategy" },
  { id: "psychology", label: "Psychology" },
  { id: "discipline", label: "Discipline" },
  { id: "custom", label: "Custom charts" },
];
const EMPTY_SECTIONS = SECTIONS.filter((s) => s.id === "summary" || s.id === "custom");

export function InsightsTab({
  filters,
  formatMoney,
  onPnlMode,
  goals,
  customCharts,
}: {
  filters: AdvancedFilters;
  formatMoney: MoneyFormatter;
  onPnlMode: (mode: ReportPnlMode) => void;
  goals: ReactNode;
  customCharts: ReactNode;
}) {
  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useAdvancedAnalytics(filters);

  if (isLoading) return <InsightsSkeleton />;
  if (isError || !data) {
    return (
      <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-[var(--color-text-primary)]">
        Couldn’t load insights.{" "}
        <button type="button" onClick={() => refetch()} className="text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const empty = data.meta.trade_count === 0;

  return (
    <DrillProvider filters={filters} formatMoney={formatMoney} periodLabel={data.meta.period_label}>
      <div className="space-y-6" aria-busy={isFetching}>
        <div className="sticky -top-4 z-20 -mt-4 flex items-center gap-3 bg-[var(--color-background)] pt-4">
          <div className="min-w-0 flex-1">
            <SectionNav sections={empty ? EMPTY_SECTIONS : SECTIONS} />
          </div>
          {isFetching && isPlaceholderData ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--color-text-muted)]" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Updating
            </span>
          ) : null}
          <div className="shrink-0">
            <Segmented<ReportPnlMode>
              value={filters.pnlMode}
              onChange={onPnlMode}
              ariaLabel="P&L basis"
              options={[
                { id: "net", label: "Net P&L" },
                { id: "gross", label: "Gross P&L" },
              ]}
            />
          </div>
        </div>

        <InsightSection
          id="summary"
          title="Executive summary"
          description={`${data.meta.period_label.charAt(0).toUpperCase()}${data.meta.period_label.slice(1)} · ${data.meta.pnl_mode === "gross" ? "Gross" : "Net"} P&L · ${data.meta.currency}`}
          hint={`${data.meta.pnl_note} ${data.meta.scope_note}`}
        >
          {empty ? <EmptyInsights /> : <ExecutiveSection data={data} formatMoney={formatMoney} />}
        </InsightSection>

        {!empty ? (
          <>
            <InsightSection
              id="findings"
              title="What stands out"
              description="Patterns in your history that differ clearly from your other trades — each one links to the trades behind it."
            >
              <FindingsSection data={data} formatMoney={formatMoney} goals={goals} />
            </InsightSection>
            <InsightSection
              id="performance"
              title="Performance"
              description="How your realized equity grew, how deep it fell, and how each month contributed."
            >
              <PerformanceSection data={data} formatMoney={formatMoney} />
            </InsightSection>
            <InsightSection
              id="risk"
              title="Risk & edge"
              description="How robust your results are: the spread of outcomes your trades could produce, your edge in R, and your streaks."
            >
              <RiskSection data={data} formatMoney={formatMoney} />
            </InsightSection>
            <InsightSection id="timing" title="Timing" description="When you trade best and worst — by weekday, hour, session, and holding time.">
              <TimingSection data={data} formatMoney={formatMoney} />
            </InsightSection>
            <InsightSection id="strategy" title="Strategy & instruments" description="Which playbooks, directions, and symbols carry your results.">
              <StrategySection data={data} formatMoney={formatMoney} />
            </InsightSection>
            <InsightSection
              id="psychology"
              title="Psychology"
              description="How your emotional state and reactions to wins and losses line up with your results."
            >
              <PsychologySection data={data} formatMoney={formatMoney} />
            </InsightSection>
            <InsightSection id="discipline" title="Discipline & process" description="Whether following your rules and plan shows up in your P&L.">
              <DisciplineSection data={data} formatMoney={formatMoney} />
            </InsightSection>
          </>
        ) : null}

        <InsightSection id="custom" title="Custom charts" description="Build your own views from any metric. These charts use your latest trades in this range.">
          {customCharts}
        </InsightSection>
      </div>
    </DrillProvider>
  );
}

function EmptyInsights() {
  return (
    <div className="dash-card flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">No closed trades in this range</p>
      <p className="max-w-md text-[12px] text-[var(--color-text-muted)]">
        Insights are built from your closed trades. Widen the date range, clear filters, or log a trade to unlock your equity curve, risk
        analysis, timing heatmap, and psychology breakdown.
      </p>
      <Link
        href="/trades/new"
        className="mt-2 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        Log a trade
      </Link>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading insights">
      <Skeleton className="h-11 rounded-full" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Skeleton className="h-[264px] rounded-[12px] lg:col-span-4" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-8 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[126px] rounded-[12px]" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Skeleton className="h-[400px] rounded-[12px] lg:col-span-8" />
        <Skeleton className="h-[400px] rounded-[12px] lg:col-span-4" />
      </div>
    </div>
  );
}
