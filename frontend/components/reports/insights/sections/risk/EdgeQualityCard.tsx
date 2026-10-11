"use client";

import type { ReactNode } from "react";

import { fmtPct, fmtR, fmtRatio, pnlColor } from "@/lib/reports/advanced/format";
import type { AdvancedAnalytics } from "@/lib/reports/advanced/types";

import { InsightCard } from "../../ui/InsightCard";

const SQN_SCALE = [
  { upto: 1.6, label: "Below avg" },
  { upto: 2.0, label: "Average" },
  { upto: 2.5, label: "Good" },
  { upto: 3.0, label: "Excellent" },
  { upto: 5.0, label: "Superb" },
];

export function EdgeQualityCard({ data }: { data: AdvancedAnalytics }) {
  const { sqn, kelly, r } = data.risk;
  const sqnPos = sqn.value != null ? Math.max(0, Math.min(1, sqn.value / 5)) : null;
  return (
    <InsightCard
      title="Edge quality"
      caption="How consistent your edge is, measured in R"
      hint="R = trade P&L ÷ the risk amount you set on the trade. Only trades with a risk amount are included."
    >
      <div className="flex h-full flex-col gap-3">
        <Block
          label="System Quality Number"
          value={sqn.status === "ok" ? fmtRatio(sqn.value) : "—"}
          badge={sqn.status === "ok" ? sqn.band : null}
          note={sqn.status === "ok" ? `${sqn.formula} · ${sqn.sample_size} trades with R` : sqn.reason}
        >
          <div className="relative mt-2 h-1.5 rounded-full bg-[var(--color-gauge-track)]">
            <div className="absolute inset-0 flex">
              {SQN_SCALE.map((s, i) => (
                <span key={s.label} className="h-full border-r border-[var(--color-surface)] last:border-0" style={{ width: `${((s.upto - (SQN_SCALE[i - 1]?.upto ?? 0)) / 5) * 100}%` }} />
              ))}
            </div>
            {sqnPos != null ? (
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-primary)] shadow"
                style={{ left: `${sqnPos * 100}%` }}
              />
            ) : null}
          </div>
          <div className="relative mt-1 h-3 text-[9px] text-[var(--color-text-muted)]">
            {[0, 1.6, 2.5, 5].map((t) => (
              <span
                key={t}
                className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                style={{ left: `${(t / 5) * 100}%` }}
              >
                {t === 5 ? "5+" : t}
              </span>
            ))}
          </div>
        </Block>

        <Block
          label="Kelly fraction (historical)"
          value={kelly.status === "ok" ? fmtPct(kelly.value_pct) : "—"}
          badge={kelly.status === "ok" ? (kelly.stability === "stable" ? "Stable estimate" : "Unstable estimate") : null}
          note={
            kelly.status === "ok"
              ? `95% range ${fmtPct(kelly.range_low_pct)} to ${fmtPct(kelly.range_high_pct)} from the win-rate uncertainty. ${kelly.note}`
              : `${kelly.reason ?? ""} ${kelly.note}`.trim()
          }
        />

        <div className="grid grid-cols-2 gap-2">
          <Mini label="Avg R per trade" value={fmtR(r.mean)} color={pnlColor(r.mean)} />
          <Mini label="R coverage" value={fmtPct(r.coverage_pct, 0)} />
          <Mini label="Trades ≥ +1R" value={fmtPct(r.share_ge_1r, 0)} />
          <Mini label="Trades ≤ −1R" value={fmtPct(r.share_le_minus_1r, 0)} />
        </div>
      </div>
    </InsightCard>
  );
}

function Block({
  label,
  value,
  badge,
  note,
  children,
}: {
  label: string;
  value: string;
  badge?: string | null;
  note?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[20px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">{value}</span>
        {badge ? (
          <span className="rounded-full bg-[var(--color-primary-very-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
      {note ? <p className="mt-1.5 text-[10.5px] leading-snug text-[var(--color-text-muted)]">{note}</p> : null}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-secondary)] px-2.5 py-1.5">
      <p className="text-[9.5px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="text-[13px] font-semibold tabular-nums" style={{ color: color ?? "var(--color-text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
