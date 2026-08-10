"use client";

import { Plus } from "lucide-react";

import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { firstName, fmtPct } from "@/lib/format";

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
  const { t, formatTodayLabelShort } = useLocale();
  const { formatMoney } = useAccountPrefs();
  const { openModal } = useAddTradeModal();
  const name = firstName(user?.name, user?.email);
  const positive = todaysPnl >= 0;

  return (
    <header className="z-30 shrink-0 border-b border-border bg-background px-6 pb-4 pt-5" data-layout="today-header-v2">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted">{formatTodayLabelShort()}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">{t("dashboard.hey", { name })}</h1>
        </div>

        <div className="mt-1 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => openModal("manual")}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {t("common.addTrade")}
          </button>
          <PortfolioSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-2">
          <span className={`font-mono text-3xl font-semibold ${positive ? "text-primary" : "text-destructive"}`}>
            {formatMoney(todaysPnl, { digits: todaysPnl === 0 ? 0 : 2 })}
          </span>
          <span className="mb-0.5 text-sm text-muted">{t("common.today")}</span>
        </div>

        <div className="flex shrink-0 items-center gap-6">
          <MiniStat label={t("dashboard.ytd")} value={ytdPct != null ? `${ytdPct >= 0 ? "+" : ""}${ytdPct.toFixed(1)}%` : "+0.0%"} />
          <MiniStat label={t("dashboard.winRate")} value={winRate != null ? fmtPct(winRate) : "—"} />
          <MiniStat label={t("dashboard.profitFactor")} value={profitFactor ? profitFactor.toFixed(2) : "—"} />
        </div>
      </div>
    </header>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-mono text-sm text-primary">{value}</div>
    </div>
  );
}
