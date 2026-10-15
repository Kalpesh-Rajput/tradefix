import type { InstrumentStatus } from "@/lib/hooks/useDataStatus";

function when(ms: number | null) {
  if (ms == null) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

export function CoverageTable({ rows }: { rows: InstrumentStatus[] }) {
  return (
    <section className="dash-card overflow-x-auto">
      <h2 className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Coverage</h2>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-medium">Symbol</th>
            <th className="px-2 py-2 font-medium">Source</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2 font-medium">Covered</th>
            <th className="px-2 py-2 font-medium">Rows</th>
            <th className="px-2 py-2 font-medium">Gap min</th>
            <th className="px-2 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.symbol} className="border-t border-border/60">
              <td className="px-4 py-2 font-medium text-foreground">{row.symbol}</td>
              <td className="px-2 py-2 text-muted">{row.source}</td>
              <td className="px-2 py-2">{row.enabled ? "Enabled" : "Disabled"}</td>
              <td className="px-2 py-2 text-muted">{when(row.covered_from)} → {when(row.covered_to)}</td>
              <td className="px-2 py-2 font-mono">{row.row_count}</td>
              <td className="px-2 py-2 font-mono">{row.gap_minutes}</td>
              <td className="px-2 py-2 text-muted">{row.updated_at ? row.updated_at.slice(0, 10) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
