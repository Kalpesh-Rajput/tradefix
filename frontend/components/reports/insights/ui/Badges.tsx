"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { HoverTip } from "@/components/ui/InfoTooltip";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import type { Evidence } from "@/lib/reports/advanced/types";

const EVIDENCE_COPY: Record<Evidence, { label: string; tip: string }> = {
  strong: {
    label: "Strong evidence",
    tip: "The gap is at least 2 standard errors, so it is unlikely to be random noise in this sample. It is still a historical pattern, not a guarantee.",
  },
  moderate: {
    label: "Moderate evidence",
    tip: "The gap is 1–2 standard errors. It could still be noise — treat it as a pattern to watch.",
  },
  weak: {
    label: "Weak evidence",
    tip: "The gap is smaller than the normal variation in your results. Do not act on it yet.",
  },
  insufficient: {
    label: "Too few trades",
    tip: "Needs at least 5 trades on each side of the comparison.",
  },
};

export function EvidenceBadge({ evidence, interactive = true }: { evidence: Evidence; interactive?: boolean }) {
  const copy = EVIDENCE_COPY[evidence];
  const badge = (
      <span
        tabIndex={interactive ? 0 : undefined}
        title={interactive ? undefined : copy.tip}
        className={clsx(
          "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          evidence === "strong" && "bg-[var(--color-primary-very-light)] text-[var(--color-primary)]",
          evidence === "moderate" && "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
          (evidence === "weak" || evidence === "insufficient") &&
            "bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]"
        )}
      >
        <span className="flex gap-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1 rounded-sm"
              style={{
                background:
                  i < (evidence === "strong" ? 3 : evidence === "moderate" ? 2 : evidence === "weak" ? 1 : 0)
                    ? "currentColor"
                    : "var(--color-border)",
              }}
            />
          ))}
        </span>
        {copy.label}
      </span>
  );
  return interactive ? <HoverTip content={copy.tip}>{badge}</HoverTip> : badge;
}

export function DeltaChip({
  delta,
  format,
  invert = false,
  label = "vs previous period",
}: {
  delta: number | null | undefined;
  format: (n: number) => string;
  invert?: boolean;
  label?: string;
}) {
  if (delta == null || !Number.isFinite(delta)) {
    return <span className="whitespace-nowrap text-[10px] text-[var(--color-text-muted)]">Not enough prior trades</span>;
  }
  const good = invert ? delta < 0 : delta > 0;
  const flat = delta === 0;
  const color = flat ? "var(--color-text-muted)" : good ? PNL_PROFIT_HEX : PNL_LOSS_HEX;
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] font-medium tabular-nums" style={{ color }}>
      {!flat ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {format(Math.abs(delta))}
      <span className="ml-0.5 font-normal text-[var(--color-text-muted)]">{label}</span>
    </span>
  );
}
