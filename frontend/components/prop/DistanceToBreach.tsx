"use client";

import clsx from "clsx";
import Link from "next/link";
import { AlertTriangle, Shield } from "lucide-react";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePropDistance } from "@/lib/hooks/useProp";
import type { PropRiskState } from "@/lib/types";

function stateColor(state: PropRiskState) {
  if (state === "danger") return "text-destructive";
  if (state === "warn") return "text-amber-400";
  return "text-positive";
}

function barColor(state: PropRiskState) {
  if (state === "danger") return "bg-destructive";
  if (state === "warn") return "bg-amber-400";
  return "bg-primary";
}

export function DistanceToBreach({ className }: { className?: string }) {
  const { activeAccount, formatMoney, loading } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const { data, isLoading, isError } = usePropDistance(accountId, { enabled: !!accountId });

  if (loading || isLoading) {
    return <Skeleton className={clsx("h-28", className)} />;
  }

  if (isError || !data) {
    return null;
  }

  if (!data.enabled) {
    return (
      <div
        className={clsx(
          "rounded-xl border border-white/[0.06] bg-zinc-950/80 px-4 py-3",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Shield className="h-4 w-4 text-zinc-500" />
            Prop firm limits are off for this account.
          </div>
          <Link
            href="/settings/prop-firm"
            className="text-xs font-medium text-primary hover:underline"
          >
            Configure
          </Link>
        </div>
      </div>
    );
  }

  const worst =
    data.daily_state === "danger" || data.overall_state === "danger"
      ? "danger"
      : data.daily_state === "warn" || data.overall_state === "warn"
        ? "warn"
        : "ok";

  return (
    <div
      className={clsx(
        "rounded-xl border border-white/[0.06] bg-zinc-950/80 p-4",
        worst === "danger" && "border-destructive/40",
        worst === "warn" && "border-amber-500/30",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {worst !== "ok" ? (
            <AlertTriangle className={clsx("h-4 w-4", stateColor(worst))} />
          ) : (
            <Shield className="h-4 w-4 text-primary" />
          )}
          <h3 className="text-sm font-semibold text-white">
            Distance to breach
            {data.profile ? (
              <span className="ml-2 text-xs font-normal uppercase tracking-wider text-zinc-500">
                {data.profile}
              </span>
            ) : null}
          </h3>
        </div>
        <Link href="/settings/prop-firm" className="text-[11px] text-zinc-500 hover:text-primary">
          Settings
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Meter
          label="Daily loss"
          usedPct={data.daily_used_pct}
          state={data.daily_state}
          detail={`${formatMoney(data.daily_loss, { signed: false })} · ${data.daily_loss_pct.toFixed(2)}% of ${data.daily_limit_pct}% limit`}
        />
        <Meter
          label="Overall drawdown"
          usedPct={data.overall_used_pct}
          state={data.overall_state}
          detail={`${formatMoney(data.overall_drawdown, { signed: false })} · ${data.overall_drawdown_pct.toFixed(2)}% of ${data.overall_limit_pct}% limit`}
        />
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        Equity {formatMoney(data.equity, { signed: false })} · start{" "}
        {formatMoney(data.starting_balance, { signed: false })}
      </p>
    </div>
  );
}

function Meter({
  label,
  usedPct,
  state,
  detail,
}: {
  label: string;
  usedPct: number;
  state: PropRiskState;
  detail: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={clsx("font-mono font-medium", stateColor(state))}>{usedPct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={clsx("h-full rounded-full transition-all", barColor(state))}
          style={{ width: `${Math.min(100, Math.max(0, usedPct))}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>
    </div>
  );
}
