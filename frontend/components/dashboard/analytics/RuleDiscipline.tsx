"use client";

import { useState } from "react";

import { ChartCard } from "@/components/dashboard/zella/ChartCard";
import { CompactSelect } from "@/components/reports/CompactSelect";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { DashboardPerformance } from "@/lib/types";

import { AnalyticsEmpty, PNL_LOSS_HEX, PNL_PROFIT_HEX, formatPct, tradeLabel } from "./shared";

function DisciplineRing({ followed, violated }: { followed: number; violated: number }) {
  const total = followed + violated;
  const radius = 40;
  const stroke = 15;
  const center = 50;
  const circumference = 2 * Math.PI * radius;
  const followedLength = total > 0 ? (followed / total) * circumference : 0;

  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      {violated > 0 ? (
        <circle cx={center} cy={center} r={radius} fill="none" stroke={PNL_LOSS_HEX} strokeWidth={stroke} />
      ) : null}
      {followed > 0 ? (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={PNL_PROFIT_HEX}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={violated > 0 ? `${followedLength} ${circumference}` : undefined}
          transform={violated > 0 ? `rotate(-90 ${center} ${center})` : undefined}
        />
      ) : null}
    </svg>
  );
}

export function RuleDiscipline({ data }: { data: DashboardPerformance }) {
  const { t } = useLocale();
  const options = data.rule_discipline.options;
  const [strategyId, setStrategyId] = useState(options[0]?.id ?? "__all__");
  const selected = options.some((option) => option.id === strategyId) ? strategyId : options[0]?.id ?? "__all__";
  const stats = data.rule_discipline.by_strategy[selected];

  return (
    <ChartCard
      className="h-full min-h-0 !p-3 [&>div:first-child]:mb-1"
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
          <div className="relative min-h-[88px] w-full min-w-0 flex-1 [container-type:size]">
            <div className="absolute left-1/2 top-1/2 h-[100cqmin] w-[100cqmin] max-h-full max-w-full -translate-x-1/2 -translate-y-1/2">
              <DisciplineRing followed={stats.followed} violated={stats.violated} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[16px] font-bold leading-none tabular-nums text-[var(--color-text-primary)]">
                  {formatPct(stats.discipline_rate)}
                </span>
                <span className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">Followed</span>
              </div>
            </div>
          </div>
          <dl className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1">
              <dt className="text-[var(--color-text-muted)]">Total trades</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-text-primary)]">{tradeLabel(stats.trades)}</dd>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1">
              <dt className="text-[var(--color-text-muted)]">Rules followed</dt>
              <dd className="font-semibold tabular-nums text-[#1F7A4D]">{stats.followed}</dd>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1">
              <dt className="text-[var(--color-text-muted)]">Rules violated</dt>
              <dd className="font-semibold tabular-nums text-[#C23B3B]">{stats.violated}</dd>
            </div>
            <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1">
              <dt className="text-[var(--color-text-muted)]">Discipline rate</dt>
              <dd className="font-semibold tabular-nums text-[var(--color-text-primary)]">{formatPct(stats.discipline_rate)}</dd>
            </div>
          </dl>
          {stats.most_violated_rule ? (
            <p className="mt-1.5 text-[12px] leading-4 text-[var(--color-text-secondary)]">
              Most violated rule:{" "}
              <span className="font-semibold text-[var(--color-text-primary)]">{stats.most_violated_rule}</span>
              <span className="text-[var(--color-text-muted)]"> · {stats.most_violated_count} {stats.most_violated_count === 1 ? "trade" : "trades"}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] leading-4 text-[var(--color-text-muted)]">
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
