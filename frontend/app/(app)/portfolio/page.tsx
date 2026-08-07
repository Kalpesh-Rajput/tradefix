"use client";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { FeaturePage } from "@/components/ui/FeaturePage";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { useTrades } from "@/lib/hooks/useTrades";
import { fmtMoney, fmtPct } from "@/lib/format";

export default function PortfolioPage() {
  const { activeAccount } = useAccountPrefs();
  const { data: analytics } = useAnalytics(activeAccount?.id, { enabled: !!activeAccount?.id });
  const { data: trades = [] } = useTrades(
    { account_id: activeAccount?.id },
    { enabled: !!activeAccount?.id }
  );
  const overview = analytics?.overview;
  const open = trades.filter((t) => t.status === "open");

  return (
    <FeaturePage title="Portfolio" subtitle="Positions and account overview from your logged trades.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Net P&L" value={fmtMoney(overview?.total_pnl ?? 0)} />
        <Stat label="Win Rate" value={fmtPct(overview?.win_rate ?? 0)} />
        <Stat label="Open Positions" value={String(open.length)} />
      </div>
      {open.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {open.map((t) => (
            <li key={t.id} className="flex justify-between border-b border-white/[0.06] py-2 text-sm">
              <span className="font-mono text-white">{t.symbol}</span>
              <span className="text-zinc-500">{t.side} · {t.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5">No open positions — mark a trade as open when you add it.</p>
      )}
    </FeaturePage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-lg text-primary">{value}</div>
    </div>
  );
}
