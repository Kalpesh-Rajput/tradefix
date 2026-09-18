import { Badge } from "@/components/ui/Badge";
import { PNL_LOSS_HEX, PNL_PROFIT_HEX } from "@/lib/appearance";
import { SetupStat } from "@/lib/types";

export function SetupTable({
  setups,
  formatMoney,
}: {
  setups: SetupStat[];
  formatMoney?: (n: number, opts?: { signed?: boolean; digits?: number }) => string;
}) {
  if (setups.length === 0) {
    return (
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Tag your trades with a setup to see performance breakdowns here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] text-left text-[11px] font-medium text-[var(--color-text-muted)]">
            <th className="pb-2 font-medium">Setup</th>
            <th className="pb-2 font-medium">Trades</th>
            <th className="pb-2 font-medium">Win rate</th>
            <th className="pb-2 font-medium">Last 30d</th>
            <th className="pb-2 font-medium">Prior 30d</th>
            <th className="pb-2 text-right font-medium">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {setups.map((s) => {
            const trending = s.win_rate_last_30d - s.win_rate_prior_30d;
            const pnlLabel = formatMoney
              ? formatMoney(s.pnl)
              : `${s.pnl >= 0 ? "+" : "-"}$${Math.abs(s.pnl).toLocaleString()}`;
            return (
              <tr key={s.setup_tag} className="border-b border-[var(--color-border-subtle)] last:border-0">
                <td className="py-2 font-medium text-[var(--color-text-primary)]">{s.setup_tag}</td>
                <td className="py-2 text-[var(--color-text-secondary)]">{s.trades}</td>
                <td className="py-2 text-[var(--color-text-secondary)]">{s.win_rate}%</td>
                <td className="py-2">
                  <Badge tone={trending >= 0 ? "positive" : "negative"}>{s.win_rate_last_30d}%</Badge>
                </td>
                <td className="py-2 text-[var(--color-text-muted)]">{s.win_rate_prior_30d}%</td>
                <td
                  className="py-2 text-right font-medium tabular-nums"
                  style={{ color: s.pnl >= 0 ? PNL_PROFIT_HEX : PNL_LOSS_HEX }}
                >
                  {pnlLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
