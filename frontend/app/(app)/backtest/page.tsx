"use client";

import { FeaturePage } from "@/components/ui/FeaturePage";
import { useAnalytics } from "@/lib/hooks/useAnalytics";
import { fmtMoney } from "@/lib/format";

export default function BacktestPage() {
  const { data: analytics } = useAnalytics();
  const setups = analytics?.by_setup ?? [];

  return (
    <FeaturePage title="Backtest" subtitle="Review historical edge by strategy tag from your trade log.">
      {setups.length === 0 ? (
        <p>Tag setups on trades to build a strategy backtest table here.</p>
      ) : (
        <ul className="space-y-2">
          {setups.map((s) => (
            <li key={s.setup_tag} className="flex items-center justify-between border-b border-white/[0.06] py-2">
              <span className="text-white">{s.setup_tag}</span>
              <span className={s.pnl >= 0 ? "font-mono text-primary" : "font-mono text-destructive"}>
                {fmtMoney(s.pnl)} · {s.trades} trades
              </span>
            </li>
          ))}
        </ul>
      )}
    </FeaturePage>
  );
}
