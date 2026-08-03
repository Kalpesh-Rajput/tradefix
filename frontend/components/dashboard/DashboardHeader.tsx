"use client";

import { Briefcase, ChevronDown, Plus } from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { firstName, fmtMoney, fmtPct, todayLabelShort } from "@/lib/format";

export function DashboardHeader({
  todaysPnl,
  ytdPct,
  winRate,
  profitFactor,
}: {
  todaysPnl: number;
  ytdPct?: number;
  winRate?: number;
  profitFactor?: number;
}) {
  const { user } = useAuth();
  const { openModal } = useAddTradeModal();
  const name = firstName(user?.name, user?.email);
  const positive = todaysPnl >= 0;

  return (
    <header className="z-30 shrink-0 border-b border-white/[0.06] bg-black px-6 pb-4 pt-5" data-layout="today-header-v2">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">{todayLabelShort()}</p>
          <h1 className="font-serif text-4xl tracking-tight text-white">Hey, {name}.</h1>
        </div>

        {/* Keep Add Trade immediately left of Default Portfolio */}
        <div className="mt-1 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => openModal("manual")}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#00C896] px-3.5 text-sm font-semibold text-black hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add Trade
          </button>
          <button
            type="button"
            className="inline-flex h-9 min-w-[180px] items-center justify-between gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="truncate">Default Portfolio</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Second row: today's P&L | YTD / Win Rate / Profit Factor */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-2">
          <span className={`font-mono text-3xl font-semibold ${positive ? "text-primary" : "text-destructive"}`}>
            {fmtMoney(todaysPnl, { digits: todaysPnl === 0 ? 0 : 2 })}
          </span>
          <span className="mb-0.5 text-sm text-zinc-500">today</span>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <MiniStat label="YTD" value={ytdPct != null ? `${ytdPct >= 0 ? "+" : ""}${ytdPct.toFixed(1)}%` : "+0.0%"} />
          <MiniStat label="Win Rate" value={winRate != null ? fmtPct(winRate) : "—"} />
          <MiniStat label="Profit Factor" value={profitFactor ? profitFactor.toFixed(2) : "—"} />
        </div>
      </div>
    </header>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-mono text-sm text-primary">{value}</div>
    </div>
  );
}
