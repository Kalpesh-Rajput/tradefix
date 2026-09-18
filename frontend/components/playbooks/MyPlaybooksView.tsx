"use client";

import { LayoutGrid, List, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { PlaybookRowMenu } from "@/components/playbooks/PlaybookRowMenu";
import { Button } from "@/components/ui/Button";
import { formatMetricValue } from "@/lib/reports/format";
import { playbookPerformance, tradesForPlaybook, type PlaybookPerformance } from "@/lib/playbooks/stats";
import type { UserPlaybook } from "@/lib/playbooks/types";
import type { DisplayPnlFn, MoneyFormatter } from "@/lib/reports/types";
import type { Trade } from "@/lib/types";

export function MyPlaybooksView({
  playbooks,
  trades,
  displayPnl,
  formatMoney,
  view,
  onView,
  onCreate,
  onBrowse,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  playbooks: UserPlaybook[];
  trades: Trade[];
  displayPnl: DisplayPnlFn;
  formatMoney: MoneyFormatter;
  view: "list" | "grid";
  onView: (view: "list" | "grid") => void;
  onCreate: () => void;
  onBrowse: () => void;
  onEdit: (playbook: UserPlaybook) => void;
  onDuplicate: (playbook: UserPlaybook) => void;
  onDelete: (playbook: UserPlaybook) => void;
}) {
  const rows = useMemo(
    () =>
      playbooks.map((pb) => ({
        playbook: pb,
        stats: playbookPerformance(tradesForPlaybook(trades, pb), displayPnl),
      })),
    [playbooks, trades, displayPnl]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Overview</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--color-border)] p-0.5">
            <button
              type="button"
              aria-label="List view"
              onClick={() => onView("list")}
              className={`inline-flex h-7 w-7 items-center justify-center rounded ${view === "list" ? "bg-[var(--color-primary-very-light)] text-primary" : "text-[var(--color-text-muted)]"}`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => onView("grid")}
              className={`inline-flex h-7 w-7 items-center justify-center rounded ${view === "grid" ? "bg-[var(--color-primary-very-light)] text-primary" : "text-[var(--color-text-muted)]"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button type="button" onClick={onCreate} className="h-8 rounded-md px-3 text-[12px]">
            <Plus className="h-3.5 w-3.5" />
            Create playbook
          </Button>
        </div>
      </div>

      {!playbooks.length ? (
        <div className="dash-card px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">No playbooks yet.</p>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            Create your first playbook from scratch or start with a predefined template.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={onCreate}>
              Create playbook
            </Button>
            <Button type="button" variant="secondary" onClick={onBrowse}>
              Browse templates
            </Button>
          </div>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ playbook, stats }) => (
            <Link
              key={playbook.id}
              href={`/playbooks/${playbook.id}`}
              className="dash-card p-3.5 transition-colors hover:bg-[var(--color-primary-very-light)]"
            >
              <p className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                {playbook.icon ? `${playbook.icon} ` : ""}
                {playbook.name}
              </p>
              <p className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--color-text-secondary)]">
                <span>Win {stats.winRate.toFixed(0)}%</span>
                <span>{stats.wins + stats.losses + stats.be} trades</span>
                <span>{formatMetricValue(stats.winPnl + stats.lossPnl, "currency", formatMoney)}</span>
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <PlaybookTable
          rows={rows}
          formatMoney={formatMoney}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function PlaybookTable({
  rows,
  formatMoney,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  rows: { playbook: UserPlaybook; stats: PlaybookPerformance }[];
  formatMoney: MoneyFormatter;
  onEdit: (playbook: UserPlaybook) => void;
  onDuplicate: (playbook: UserPlaybook) => void;
  onDelete: (playbook: UserPlaybook) => void;
}) {
  return (
    <div className="dash-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full text-left text-[12px]">
          <thead className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Title</th>
              <th className="px-3 py-2.5 font-medium">Average loser</th>
              <th className="px-3 py-2.5 font-medium">Average winner</th>
              <th className="px-3 py-2.5 font-medium">Total net P&L</th>
              <th className="px-3 py-2.5 font-medium">Profit factor</th>
              <th className="px-3 py-2.5 font-medium">Trades</th>
              <th className="px-3 py-2.5 font-medium">Expectancy</th>
              <th className="px-3 py-2.5 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ playbook, stats }) => (
              <tr key={playbook.id} className="border-b border-[var(--color-border-subtle)] last:border-0">
                <td className="px-3 py-3">
                  <Link href={`/playbooks/${playbook.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline">
                    {playbook.icon ? `${playbook.icon} ` : ""}
                    {playbook.name}
                  </Link>
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {stats.avgLoss == null ? "—" : formatMetricValue(stats.avgLoss, "currency", formatMoney)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {stats.avgWin == null ? "—" : formatMetricValue(stats.avgWin, "currency", formatMoney)}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {formatMetricValue(stats.winPnl + stats.lossPnl, "currency", formatMoney)}
                </td>
                <td className="px-3 py-3 tabular-nums">{stats.profitFactor == null ? "N/A" : stats.profitFactor.toFixed(2)}</td>
                <td className="px-3 py-3 tabular-nums">{stats.wins + stats.losses + stats.be}</td>
                <td className="px-3 py-3 tabular-nums">
                  {stats.expectancy == null ? "—" : formatMetricValue(stats.expectancy, "currency", formatMoney)}
                </td>
                <td className="px-3 py-3">
                  <PlaybookRowMenu
                    onOpen={`/playbooks/${playbook.id}`}
                    onEdit={() => onEdit(playbook)}
                    onDuplicate={() => onDuplicate(playbook)}
                    onDelete={() => onDelete(playbook)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
        {rows.length} {rows.length === 1 ? "playbook" : "playbooks"}
      </p>
    </div>
  );
}
