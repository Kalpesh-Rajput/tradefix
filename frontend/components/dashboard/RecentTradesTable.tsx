"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { fmtMoney } from "@/lib/format";
import { Trade } from "@/lib/types";

const PAGE_SIZE = 6;

export function RecentTradesTable({ trades }: { trades: Trade[] }) {
  const [q, setQ] = useState("");
  const [side, setSide] = useState<"all" | "long" | "short">("all");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<"date" | "pnl">("date");

  const filtered = useMemo(() => {
    let rows = [...trades];
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.symbol.toLowerCase().includes(needle) ||
          (t.setup_tag ?? "").toLowerCase().includes(needle)
      );
    }
    if (side !== "all") rows = rows.filter((t) => t.side === side);
    rows.sort((a, b) => {
      if (sort === "pnl") return (b.pnl ?? 0) - (a.pnl ?? 0);
      return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
    });
    return rows;
  }, [trades, q, side, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-5 pt-5">
        <CardHeader
          title="Recent Trades"
          subtitle="Filter, sort, and review your latest executions"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search ticker…"
                  className="h-9 w-40 !py-1.5 pl-8 text-xs"
                />
              </div>
              <select
                value={side}
                onChange={(e) => {
                  setSide(e.target.value as typeof side);
                  setPage(0);
                }}
                className="h-9 rounded-xl border border-white/[0.08] bg-surface-2 px-2 text-xs text-white"
              >
                <option value="all">All sides</option>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="h-9 rounded-xl border border-white/[0.08] bg-surface-2 px-2 text-xs text-white"
              >
                <option value="date">Sort: Date</option>
                <option value="pnl">Sort: P&L</option>
              </select>
            </div>
          }
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-y border-white/[0.06] text-[11px] uppercase tracking-wider text-muted">
              {["Date", "Ticker", "Direction", "Setup", "Entry", "Exit", "Risk", "Reward", "PnL", "Status", ""].map(
                (h) => (
                  <th key={h || "a"} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">
                  No trades match your filters.
                </td>
              </tr>
            )}
            {slice.map((t) => {
              const risk = Number(t.entry_price) * 0.01;
              const reward = t.exit_price != null ? Math.abs(Number(t.exit_price) - Number(t.entry_price)) : null;
              return (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    {new Date(t.opened_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{t.symbol}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.side === "long" ? "positive" : "negative"}>{t.side}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{t.setup_tag || "—"}</td>
                  <td className="px-4 py-3 text-muted">{Number(t.entry_price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted">
                    {t.exit_price != null ? Number(t.exit_price).toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{risk.toFixed(2)}</td>
                  <td className="px-4 py-3 text-muted">{reward != null ? reward.toFixed(2) : "—"}</td>
                  <td className={`px-4 py-3 font-medium ${(t.pnl ?? 0) >= 0 ? "text-accent" : "text-danger"}`}>
                    {t.pnl != null ? fmtMoney(t.pnl) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={t.status === "open" ? "warning" : "neutral"}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/journal/${t.id}`} className="text-xs text-secondary hover:underline">
                      View
                    </Link>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-3 text-xs text-muted">
        <span>
          {filtered.length} trade{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg p-1.5 hover:bg-white/[0.05] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg p-1.5 hover:bg-white/[0.05] disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
