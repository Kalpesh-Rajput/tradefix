"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";

export const CHART_BODY_H = 200;
export const CHART_BODY_COMPACT = 168;
export const DASH_GAP_PX = 12;
export const CHART_CARD_H = 14 * 2 + 24 + 8 + CHART_BODY_H;
export const DASH_CALENDAR_H = CHART_CARD_H * 2 + DASH_GAP_PX;

export const chartTooltipStyle = {
  background: "#fff",
  border: "1px solid #E8E8EC",
  borderRadius: 8,
  fontSize: 11,
  boxShadow: "0 4px 12px rgba(20,20,30,0.08)",
  padding: "6px 10px",
  color: "#1F1F24",
};

export function ChartCard({
  title,
  children,
  className = "",
  headerRight,
  hint,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
  hint?: string;
}) {
  return (
    <div className={`dash-card flex h-full min-h-0 flex-col p-3.5 ${className}`}>
      <div className="mb-2 flex h-6 shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h3 className="truncate text-[12px] font-medium leading-4 text-[var(--color-text-primary)]">
            {title}
          </h3>
          {hint && (
            <span title={hint} className="shrink-0 text-[#8B8D96]">
              <Info className="h-3 w-3" strokeWidth={1.75} />
            </span>
          )}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

export function EmptyChart({ height }: { height: number }) {
  return (
    <div
      className="flex w-full items-center justify-center text-[11px] text-[var(--color-text-muted)]"
      style={{ height }}
    >
      No trade data in this range
    </div>
  );
}
