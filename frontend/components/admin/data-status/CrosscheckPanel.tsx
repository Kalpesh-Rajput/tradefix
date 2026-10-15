import type { CrosscheckRow } from "@/lib/hooks/useDataStatus";

function price(value: number | null) {
  return value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

export function CrosscheckPanel({ rows, differences }: { rows: CrosscheckRow[]; differences: CrosscheckRow[] }) {
  return (
    <section className="dash-card overflow-x-auto">
      <h2 className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Daily cross-check</h2>
      <p className="px-4 py-2 text-xs text-muted">
        Crypto is compared with Binance daily klines. Forex is compared with the ECB rate at 14:10 Europe/Berlin. Metals have no reference.
        {differences.length ? ` ${differences.length} difference${differences.length === 1 ? "" : "s"} in the latest rows.` : " No differences in the latest rows."}
      </p>
      {rows.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No cross-check has been stored yet.</p> : null}
      {rows.length > 0 ? (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2 font-medium">Symbol</th>
              <th className="px-2 py-2 font-medium">Day</th>
              <th className="px-2 py-2 font-medium">Stored</th>
              <th className="px-2 py-2 font-medium">Reference</th>
              <th className="px-2 py-2 font-medium">Gap %</th>
              <th className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.instrument}-${row.day}`} className="border-t border-border/60">
                <td className="px-4 py-2 font-medium text-foreground">{row.instrument}</td>
                <td className="px-2 py-2 text-muted">{row.day}</td>
                <td className="px-2 py-2 font-mono">{price(row.stored_close)}</td>
                <td className="px-2 py-2 font-mono">{price(row.reference_close)}</td>
                <td className="px-2 py-2 font-mono">{row.difference == null ? "—" : row.difference.toFixed(3)}</td>
                <td className={`px-2 py-2 ${row.status === "difference" ? "text-negative" : "text-muted"}`}>{row.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
