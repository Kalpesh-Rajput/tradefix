"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { BAR_LOSS_HEX, BAR_PROFIT_HEX, PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { fmtPct, fmtR, fmtRatio, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import { prefersReducedMotion } from "@/lib/tradefix-score/labels";

import { AXIS_TICK, GRID_STROKE, TooltipRow, TooltipShell } from "../../ui/chart";
import { InsightCard, InsufficientState, Stat } from "../../ui/InsightCard";

const BODY_H = 220;

export function PlanOutcomeCard({ data }: { data: AdvancedAnalytics }) {
  const p = data.risk.plan;
  const ok = p.status === "ok";
  const planned = p.avg_planned_r ?? 0;
  const realized = p.avg_realized_r ?? 0;
  const scale = Math.max(Math.abs(planned), Math.abs(realized), 1);
  return (
    <InsightCard
      title="Planned vs realized R"
      caption={ok ? `${p.sample_size} trades with a valid stop and target` : "Did trades play out the way you planned?"}
      hint={p.note}
    >
      {!ok ? (
        <InsufficientState reason={`${p.reason ?? ""} Add a stop loss and take profit when logging trades to unlock this.`.trim()} height={BODY_H} />
      ) : (
        <div className="flex flex-col gap-3" style={{ minHeight: BODY_H }}>
          {[
            { label: "Planned reward : risk", value: planned, color: "var(--color-primary)" },
            { label: "Realized R", value: realized, color: realized >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX },
          ].map((b) => (
            <div key={b.label}>
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="text-[var(--color-text-secondary)]">{b.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: b.color }}>
                  {fmtR(b.value)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(Math.abs(b.value) / scale) * 100}%`, background: b.color }} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Hit target" value={fmtPct(p.target_reached_pct, 0)} hint="Share of trades whose result reached the planned target R or better." />
            <Stat label="Full stop" value={fmtPct(p.full_stop_pct, 0)} hint="Share of trades that lost the full planned risk (−1R or worse)." />
            <Stat label="Capture" value={fmtPct(p.avg_capture_pct, 0)} hint="Average of realized R ÷ planned reward:risk across these trades. 100% means trades returned what was planned on average." />
          </div>
          <p className="text-[10.5px] leading-snug text-[var(--color-text-muted)]">{p.note}</p>
        </div>
      )}
    </InsightCard>
  );
}

export function StreaksCard({ data }: { data: AdvancedAnalytics }) {
  const s = data.risk.streaks;
  const currentColor = s.current_type === "win" ? PNL_PROFIT_HEX : s.current_type === "loss" ? PNL_LOSS_HEX : undefined;
  return (
    <InsightCard
      title="Win & loss streaks"
      caption="How often runs of each length happened, in entry order"
      hint="A streak is consecutive wins or consecutive losses. A breakeven trade ends the streak."
    >
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Longest win" value={s.max_win_streak} color={s.max_win_streak ? PNL_PROFIT_HEX : undefined} sub={`avg ${fmtRatio(s.avg_win_streak, 1)}`} />
        <Stat label="Longest loss" value={s.max_loss_streak} color={s.max_loss_streak ? PNL_LOSS_HEX : undefined} sub={`avg ${fmtRatio(s.avg_loss_streak, 1)}`} />
        <Stat
          label="Current"
          value={s.current_length ? `${s.current_length} ${s.current_type}${s.current_length > 1 ? "s" : ""}` : "—"}
          color={currentColor}
        />
      </div>
      {!s.max_win_streak && !s.max_loss_streak ? (
        <div className="mt-2" style={{ height: BODY_H - 64 }}>
          <InsufficientState reason="No streaks yet in this range." />
        </div>
      ) : (
        <div className="mt-2" style={{ height: BODY_H - 64 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.distribution} margin={{ top: 6, right: 4, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="length" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(n: number) => `${n}`} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                cursor={{ fill: "var(--color-surface-secondary)" }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as (typeof s.distribution)[number] | undefined;
                  if (!active || !d) return null;
                  return (
                    <TooltipShell title={`Streaks of ${d.length}`}>
                      <TooltipRow label="Win streaks" value={d.win_streaks} color={PNL_PROFIT_HEX} />
                      <TooltipRow label="Loss streaks" value={d.loss_streaks} color={PNL_LOSS_HEX} />
                    </TooltipShell>
                  );
                }}
              />
              <Bar dataKey="win_streaks" fill={BAR_PROFIT_HEX} radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion()} />
              <Bar dataKey="loss_streaks" fill={BAR_LOSS_HEX} radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion()} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </InsightCard>
  );
}

export function AllStatsCard({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: (n: number) => string }) {
  const s = data.summary;
  const m = (v: number | null) => (v == null ? "—" : formatMoney(v));
  const rows: [string, string, string?][] = [
    ["Closed trades", s.trades.toLocaleString()],
    ["Wins / losses / breakeven", `${s.wins} / ${s.losses} / ${s.breakeven}`],
    ["Gross profit", m(s.gross_profit), PNL_PROFIT_HEX],
    ["Gross loss", m(-s.gross_loss), PNL_LOSS_HEX],
    ["Average win", m(s.avg_win), pnlColor(s.avg_win)],
    ["Average loss", m(s.avg_loss), pnlColor(s.avg_loss)],
    ["Largest win", m(s.largest_win), pnlColor(s.largest_win)],
    ["Largest loss", m(s.largest_loss), pnlColor(s.largest_loss)],
    ["Fees & commissions", m(s.total_fees)],
    ["Trading days", s.trading_days.toLocaleString()],
    ["Green / red days", `${s.green_days} / ${s.red_days}`],
    ["Best day", m(s.best_day), pnlColor(s.best_day)],
    ["Worst day", m(s.worst_day), pnlColor(s.worst_day)],
    ["Recovery factor", fmtRatio(s.recovery_factor)],
    ["Average R", fmtR(s.avg_r)],
    ["Avg execution score", s.avg_execution != null ? `${s.avg_execution.toFixed(0)} / 100` : "—"],
  ];
  return (
    <InsightCard title="All statistics" caption={`${data.meta.period_label} · ${data.meta.pnl_mode === "gross" ? "gross" : "net"} P&L`} hint={data.meta.pnl_note}>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {rows.map(([label, value, color]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 border-b border-[var(--color-border-subtle)] py-1.5 text-[11.5px] last:border-0">
            <dt className="truncate text-[var(--color-text-tertiary)]">{label}</dt>
            <dd className="font-semibold tabular-nums" style={{ color: color ?? "var(--color-text-primary)" }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </InsightCard>
  );
}
