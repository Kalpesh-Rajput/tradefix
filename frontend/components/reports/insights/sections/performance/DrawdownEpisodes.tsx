"use client";

import { fmtIsoDate, fmtPct } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";
import type { MoneyFormatter } from "@/lib/reports/types";
import { PNL_LOSS_HEX } from "@/lib/appearance";

import { InsightCard, InsufficientState, Stat } from "../../ui/InsightCard";

export function DrawdownEpisodes({ data, formatMoney }: { data: AdvancedAnalytics; formatMoney: MoneyFormatter }) {
  const { episodes } = data.performance.equity;
  const s = data.summary;
  const deepest = episodes[0]?.depth || 0;
  return (
    <InsightCard
      title="Drawdown episodes"
      caption="Deepest peak-to-trough falls and how long they took to recover"
      hint="An episode starts at an equity peak, bottoms at the trough, and ends when realized equity returns to that peak. Unrecovered episodes are still open."
    >
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Recovery factor"
          value={s.recovery_factor != null ? s.recovery_factor.toFixed(2) : "—"}
          hint="Total P&L ÷ max drawdown. How many times over your profits have paid back your worst drawdown."
        />
        <Stat label="Max drawdown" value={fmtPct(s.max_drawdown_pct)} color={s.max_drawdown ? PNL_LOSS_HEX : undefined} sub={formatMoney(-s.max_drawdown)} />
      </div>
      {!episodes.length ? (
        <div className="mt-2 h-[262px]">
          <InsufficientState reason="No drawdown yet — realized equity has only made new highs in this range." />
        </div>
      ) : (
        <ol className="mt-2 max-h-[262px] space-y-1.5 overflow-y-auto pr-0.5">
          {episodes.map((e, i) => (
            <li key={`${e.start_date}-${i}`} className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: PNL_LOSS_HEX }}>
                  {formatMoney(-e.depth)}
                  {e.depth_pct != null ? (
                    <span className="ml-1 text-[10px] font-medium text-[var(--color-text-muted)]">{fmtPct(-e.depth_pct)}</span>
                  ) : null}
                </span>
                <span
                  className={
                    e.recovered
                      ? "text-[10px] font-medium text-[var(--color-text-muted)]"
                      : "rounded-full bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--color-text-secondary)]"
                  }
                >
                  {e.recovered ? `Recovered in ${e.trades_to_recover} ${e.trades_to_recover === 1 ? "trade" : "trades"}` : "Open"}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--color-gauge-track)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${deepest ? Math.max(4, (e.depth / deepest) * 100) : 0}%`, background: PNL_LOSS_HEX, opacity: 0.7 }}
                />
              </div>
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                {fmtIsoDate(e.start_date)} → {fmtIsoDate(e.trough_date)}
                {e.recovered ? ` → ${fmtIsoDate(e.recovery_date)}` : ""} · {e.trades_to_trough} {e.trades_to_trough === 1 ? "trade" : "trades"} down
                {e.days != null ? ` · ${e.days}d` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </InsightCard>
  );
}
