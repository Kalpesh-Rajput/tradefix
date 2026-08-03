import { Badge } from "@/components/ui/Badge";
import { SetupStat } from "@/lib/types";

export function SetupTable({ setups }: { setups: SetupStat[] }) {
  if (setups.length === 0) {
    return <p className="text-sm text-gray-500">Tag your trades with a setup to see performance breakdowns here.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2">Setup</th>
            <th className="px-4 py-2">Trades</th>
            <th className="px-4 py-2">Win rate</th>
            <th className="px-4 py-2">Last 30d</th>
            <th className="px-4 py-2">Prior 30d</th>
            <th className="px-4 py-2 text-right">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {setups.map((s) => {
            const trending = s.win_rate_last_30d - s.win_rate_prior_30d;
            return (
              <tr key={s.setup_tag} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium text-white">{s.setup_tag}</td>
                <td className="px-4 py-2 text-gray-300">{s.trades}</td>
                <td className="px-4 py-2 text-gray-300">{s.win_rate}%</td>
                <td className="px-4 py-2">
                  <Badge tone={trending >= 0 ? "positive" : "negative"}>{s.win_rate_last_30d}%</Badge>
                </td>
                <td className="px-4 py-2 text-gray-400">{s.win_rate_prior_30d}%</td>
                <td className={`px-4 py-2 text-right font-medium ${s.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                  {s.pnl >= 0 ? "+" : "-"}${Math.abs(s.pnl).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
