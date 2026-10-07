"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { CompactSelect } from "@/components/reports/CompactSelect";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance } from "@/lib/types";

import { AnalyticsEmpty, PNL_LOSS_HEX, PNL_PROFIT_HEX, formatPct, tradeLabel } from "./shared";

export function RuleDiscipline({ data }: { data: DashboardPerformance }) {
  const { t } = useLocale();
  const options = data.rule_discipline.options;
  const [strategyId, setStrategyId] = useState(options[0]?.id ?? "__all__");
  const selected = options.some((option) => option.id === strategyId) ? strategyId : options[0]?.id ?? "__all__";
  const stats = data.rule_discipline.by_strategy[selected];
  const slices = [
    { name: "Followed", value: stats?.followed ?? 0, fill: PNL_PROFIT_HEX },
    { name: "Not followed", value: stats?.violated ?? 0, fill: PNL_LOSS_HEX },
  ].filter((slice) => slice.value > 0);

  return (
    <ChartCard
      className="!h-auto !min-h-min"
      title={t("dashboard.ruleDiscipline")}
      hint={t("dashboard.hint.ruleDiscipline")}
      headerRight={
        options.length > 0 ? (
          <CompactSelect
            value={selected}
            options={options.map((option) => ({ id: option.id, label: option.label }))}
            onChange={setStrategyId}
            ariaLabel="Strategy"
            width={148}
          />
        ) : null
      }
    >
      {!data.has_trades || !stats || stats.trades === 0 ? (
        <AnalyticsEmpty title={t("dashboard.empty.title")} body={t("dashboard.empty.rules")} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative mx-auto h-[132px] w-full max-w-[200px]">
            <ResponsiveContainer width="100%" height={132}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={58}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[18px] font-bold tabular-nums text-[var(--color-text-primary)]">
                {formatPct(stats.discipline_rate)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">Followed</span>
            </div>
          </div>
          <dl className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5">
              <dt className="text-[var(--color-text-muted)]">Total trades</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-text-primary)]">{tradeLabel(stats.trades)}</dd>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5">
              <dt className="text-[var(--color-text-muted)]">Rules followed</dt>
              <dd className="font-semibold tabular-nums text-[#1F7A4D]">{stats.followed}</dd>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5">
              <dt className="text-[var(--color-text-muted)]">Rules violated</dt>
              <dd className="font-semibold tabular-nums text-[#C23B3B]">{stats.violated}</dd>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5">
              <dt className="text-[var(--color-text-muted)]">Discipline rate</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-text-primary)]">{formatPct(stats.discipline_rate)}</dd>
            </div>
          </dl>
          {stats.most_violated_rule ? (
            <p className="mt-2 text-[12px] leading-4 text-[var(--color-text-secondary)]">
              Most violated rule:{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">{stats.most_violated_rule}</span>
              <span className="text-[var(--color-text-muted)]"> · {stats.most_violated_count} {stats.most_violated_count === 1 ? "trade" : "trades"}</span>
            </p>
          ) : (
            <p className="mt-2 text-[12px] leading-4 text-[var(--color-text-muted)]">
              No broken rules were marked on these trades.
            </p>
          )}
          <p className="mt-1 text-[10px] leading-4 text-[var(--color-text-muted)]">
            A trade counts as followed when you did not mark a rule as broken.
          </p>
        </div>
      )}
    </ChartCard>
  );
}
