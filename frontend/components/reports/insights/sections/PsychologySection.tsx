"use client";

import { fmtPct, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";

import { useDrill } from "../DrillContext";
import { EvidenceBadge } from "../ui/Badges";
import { BucketBars, useBucketMetric } from "../ui/BucketBars";
import { ComparisonList } from "../ui/ComparisonList";
import { InsightCard, InsufficientState } from "../ui/InsightCard";

const LIST_H = 280;
const BAR_H = 200;

export function PsychologySection({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const p = data.psychology;
  const moodMetric = useBucketMetric("avg");
  const afterMetric = useBucketMetric("avg");
  const tnMetric = useBucketMetric("avg");
  const useMoodScores = !p.moods.rows.length && p.mood_scores.length > 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <InsightCard
          title="Emotions"
          caption={`${p.emotions.labelled_trades} of ${data.meta.trade_count} trades have an emotion tag`}
          hint="Each emotion is compared with every trade that does not carry it. Click a label to see its trades."
        >
          <ComparisonList
            block={p.emotions}
            dimension="emotion"
            drillTitle={(l) => `Trades tagged “${l}”`}
            formatMoney={formatMoney}
            emptyReason="Tag emotions on your trades to see how each state relates to your results."
            height={LIST_H}
          />
        </InsightCard>

        <InsightCard
          title={useMoodScores ? "Mood score" : "Mood"}
          caption={
            useMoodScores
              ? "Result by the mood score logged with the trade (1–5)"
              : `${p.moods.labelled_trades} of ${data.meta.trade_count} trades have a mood`
          }
          hint="Mood comes from the trade itself or the mood check-in nearest before entry on the same day."
          actions={useMoodScores ? moodMetric.control : null}
        >
          {useMoodScores ? (
            <BucketBars
              rows={p.mood_scores}
              metric={moodMetric.metric}
              dimension="mood_score"
              drillTitle={(r) => `Trades at ${r.label}`}
              formatMoney={formatMoney}
              height={LIST_H}
            />
          ) : (
            <ComparisonList
              block={p.moods}
              dimension="mood"
              drillTitle={(l) => `Trades logged with mood “${l}”`}
              formatMoney={formatMoney}
              emptyReason="Log a mood on trades or with mood check-ins to see how your state relates to results."
              height={LIST_H}
            />
          )}
        </InsightCard>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        <InsightCard title="After a win or loss" caption={p.after_rule} hint={p.after_rule} actions={afterMetric.control}>
          {!p.after_outcome.length ? (
            <InsufficientState reason="No closed trades in this range yet." height={BAR_H + 64} />
          ) : (
            <>
              <BucketBars
                rows={p.after_outcome}
                metric={afterMetric.metric}
                dimension="after"
                drillTitle={(r) => r.label}
                formatMoney={formatMoney}
                height={BAR_H}
              />
              <QuickReentry data={data} formatMoney={formatMoney} />
            </>
          )}
        </InsightCard>

        <InsightCard
          title="Trade number of the day"
          caption="Result by the order trades were opened each day"
          hint="Counts trades in entry order within each local trading day across the selected account, before symbol or tag filters."
          actions={tnMetric.control}
        >
          {!data.meta.trade_count ? (
            <InsufficientState reason="No closed trades in this range yet." height={BAR_H + 64} />
          ) : (
            <BucketBars
              rows={p.trade_number}
              metric={tnMetric.metric}
              dimension="trade_number"
              drillTitle={(r) => `${r.label}`}
              formatMoney={formatMoney}
              height={BAR_H + 64}
            />
          )}
        </InsightCard>
      </div>
    </div>
  );
}

function QuickReentry({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const drill = useDrill();
  const q = data.psychology.quick_reentry;
  if (!q.quick.trades) {
    return (
      <p className="mt-2 rounded-lg bg-[var(--color-surface-secondary)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        No quick re-entries: you never opened a trade within {q.window_minutes} minutes of a losing exit in this range.
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => drill({ dimension: "quick_reentry", key: "yes" }, `Re-entries within ${q.window_minutes} min of a loss`)}
      title={q.rule}
      className="mt-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-3 py-2 text-left outline-none hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span className="text-[11px] text-[var(--color-text-secondary)]">
        <span className="font-semibold text-[var(--color-text-primary)]">{q.quick.trades} quick re-entries</span> (≤{q.window_minutes} min after a loss):
        avg{" "}
        <span className="font-semibold tabular-nums" style={{ color: pnlColor(q.quick.avg_pnl) }}>
          {q.quick.avg_pnl != null ? formatMoney(q.quick.avg_pnl) : "—"}
        </span>
        , {fmtPct(q.quick.win_rate, 0)} win — vs{" "}
        <span className="tabular-nums" style={{ color: pnlColor(q.patient.avg_pnl) }}>
          {q.patient.avg_pnl != null ? formatMoney(q.patient.avg_pnl) : "—"}
        </span>{" "}
        for {q.patient.trades} other trades after a loss
      </span>
      <EvidenceBadge evidence={q.comparison.evidence} interactive={false} />
    </button>
  );
}
