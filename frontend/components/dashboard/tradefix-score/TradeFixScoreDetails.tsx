"use client";

import { Info, X } from "lucide-react";
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

import { SCORE_METRIC_LABEL, SCORE_METRIC_ORDER, scoreBand } from "@/lib/tradefix-score/labels";
import type { TradeFixScoreMetricKey, TradeFixScoreResult } from "@/lib/types";

export function TradeFixScoreDetails({
  score,
  formatMoney,
  onClose,
  focusKey,
}: {
  score: TradeFixScoreResult;
  formatMoney: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
  onClose: () => void;
  focusKey?: TradeFixScoreMetricKey | null;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const band = scoreBand(score.overall_score);
  const moneyKeys = new Set(["gross_profit", "gross_loss", "avg_win", "avg_loss", "net_pnl", "max_drawdown", "peak_equity", "starting_equity", "top_win_pnl"]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="tf-overlay-scrim absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(780px,92vh)] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[16px] font-semibold text-[var(--color-text-primary)]">
              TradeFix Score calculation
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
              Composite performance profile from closed trades — not a skill rating.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-background)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Final score</p>
              <p className="text-[28px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
                {score.overall_score == null ? "—" : score.overall_score.toFixed(1)}
                <span className="ml-1 text-[13px] font-medium text-[var(--color-text-muted)]">/ 100</span>
              </p>
            </div>
            <p className="text-right text-[12px] text-[var(--color-text-secondary)]">
              {band.label}
              <br />
              {score.confidence.label} · {score.sample_size} closed trades
            </p>
          </div>

          <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">{score.pnl_note}</p>

          <div className="space-y-3">
            {SCORE_METRIC_ORDER.map((key) => {
              const metric = score.metrics[key];
              if (!metric) return null;
              const focused = focusKey === key;
              return (
                <section
                  key={key}
                  className={`rounded-lg border px-3 py-2.5 ${
                    focused
                      ? "border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_6%,transparent)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                        {SCORE_METRIC_LABEL[key]}
                      </h3>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">{metric.definition}</p>
                    </div>
                    <p className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {metric.score.toFixed(0)}
                      <span className="font-medium text-[var(--color-text-muted)]">/100</span>
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] tabular-nums text-[var(--color-text-secondary)]">
                    Actual {metric.display}
                    <span className="mx-1.5 text-[var(--color-text-muted)]">·</span>
                    Weight {(metric.weight * 100).toFixed(0)}%
                    <span className="mx-1.5 text-[var(--color-text-muted)]">·</span>
                    Contribution {metric.contribution.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">How it’s calculated: {metric.formula}</p>
                  {metric.undefined_reason ? (
                    <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{metric.undefined_reason}</p>
                  ) : null}
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    {Object.entries(metric.inputs || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-[var(--color-text-muted)]">{k.replace(/_/g, " ")}</dt>
                        <dd className="tabular-nums text-[var(--color-text-primary)]">
                          {typeof v === "number"
                            ? moneyKeys.has(k)
                              ? formatMoney(v, { signed: true, digits: 2 })
                              : Number.isInteger(v)
                                ? String(v)
                                : v.toFixed(2)
                            : v == null
                              ? "—"
                              : String(v)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function TradeFixScoreInfo({ onViewDetails, onClose }: { onViewDetails: () => void; onClose: () => void }) {
  const titleId = useId();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="tf-overlay-scrim absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[420px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-dropdown)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            <h2 id={titleId} className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              How TradeFix Score works
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--color-text-muted)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          TradeFix Score combines six performance metrics from your recorded closed trades. Each metric is
          normalized to a 0–100 scale, then weighted. It is a performance summary, not a prediction of future
          results and not a measure of trading skill.
        </p>
        <ul className="mt-3 space-y-1 text-[12px] text-[var(--color-text-secondary)]">
          <li>Win Rate — 15%</li>
          <li>Profit Factor — 25%</li>
          <li>Average Win/Loss — 15%</li>
          <li>Recovery Factor — 15%</li>
          <li>Drawdown — 20%</li>
          <li>Consistency — 10%</li>
        </ul>
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-4 text-[12px] font-semibold text-[var(--color-primary)]"
        >
          View calculation details
        </button>
      </div>
    </div>,
    document.body
  );
}
