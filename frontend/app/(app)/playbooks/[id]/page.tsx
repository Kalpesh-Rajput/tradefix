"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PlaybookFormModal } from "@/components/playbooks/PlaybookFormModal";
import { PlaybooksHeader } from "@/components/playbooks/PlaybooksHeader";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { usePlaybook, useUpdatePlaybook } from "@/lib/hooks/usePlaybooks";
import { useTrades } from "@/lib/hooks/useTrades";
import { playbookPerformance, tradesForPlaybook } from "@/lib/playbooks/stats";
import { CATEGORY_LABEL } from "@/lib/playbooks/types";
import { filterReportTrades } from "@/lib/reports/filter";
import { formatMetricValue } from "@/lib/reports/format";
import type { DisplayPnlFn, MoneyFormatter } from "@/lib/reports/types";
import { TRADE_LIST_LIMIT } from "@/lib/trades/limits";
import type { Trade } from "@/lib/types";

export default function PlaybookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { dateKey } = useLocale();
  const { activeAccount, formatMoney, displayPnl } = useAccountPrefs();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editing, setEditing] = useState(false);

  const { data: playbook, isLoading, isError, refetch } = usePlaybook(params.id);
  const update = useUpdatePlaybook();
  const { data: trades = [] } = useTrades(
    {
      account_id: activeAccount?.id,
      date_from: dateFrom ? `${dateFrom}T00:00:00` : undefined,
      date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
      limit: TRADE_LIST_LIMIT,
    },
    { enabled: !!activeAccount?.id }
  );
  const tradesTruncated = trades.length >= TRADE_LIST_LIMIT;
  const reportTrades = useMemo(
    () => filterReportTrades(trades, { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, dateKey }),
    [trades, dateFrom, dateTo, dateKey]
  );
  const related = useMemo(
    () => (playbook ? tradesForPlaybook(reportTrades, playbook) : []),
    [playbook, reportTrades]
  );
  const stats = useMemo(() => playbookPerformance(related, displayPnl), [related, displayPnl]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <PlaybooksHeader dateFrom={dateFrom} dateTo={dateTo} onRangeChange={(from, to) => { setDateFrom(from); setDateTo(to); }} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {isLoading ? (
          <Skeleton className="h-64 rounded-[12px]" />
        ) : isError || !playbook ? (
          <div className="dash-card px-4 py-6 text-sm">
            Unable to load playbook.{" "}
            <button type="button" className="text-primary hover:underline" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => router.push("/playbooks")}
                  className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3 rtl:rotate-180" strokeWidth={2} />
                  My playbooks
                </button>
                <h1 className="mt-1 text-[20px] font-semibold text-[var(--color-text-primary)]">
                  {playbook.icon ? `${playbook.icon} ` : ""}
                  {playbook.name}
                </h1>
                {playbook.description ? (
                  <p className="mt-1 max-w-2xl text-[13px] text-[var(--color-text-secondary)]">{playbook.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {playbook.categories.map((id) => (
                    <span key={id} className="rounded-md bg-[var(--color-surface-secondary)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                      {CATEGORY_LABEL[id] ?? id}
                    </span>
                  ))}
                </div>
              </div>
              <Button type="button" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </div>

            {tradesTruncated ? (
              <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
                Playbook stats use the latest {TRADE_LIST_LIMIT.toLocaleString()} trades in this range.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="Win rate" value={`${stats.winRate.toFixed(stats.winRate % 1 ? 1 : 0)}%`} />
              <Kpi label="Trades" value={String(stats.wins + stats.losses + stats.be)} />
              <Kpi label="Net P&L" value={formatMetricValue(stats.winPnl + stats.lossPnl, "currency", formatMoney)} />
              <Kpi label="Profit factor" value={stats.profitFactor == null ? "N/A" : stats.profitFactor.toFixed(2)} />
              <Kpi
                label="Expectancy"
                value={stats.expectancy == null ? "—" : formatMetricValue(stats.expectancy, "currency", formatMoney)}
              />
            </div>

            <section className="dash-card p-4">
              <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Playbook rules</h2>
              <Rule title="Entry criteria" items={playbook.rules?.entry} />
              <Rule title="Confirmation" items={playbook.rules?.confirmation} />
              <Rule title="Risk management" items={playbook.rules?.risk} />
              <Rule title="Exit criteria" items={playbook.rules?.exit} />
              {playbook.rules?.notes ? <p className="mt-3 text-[12px] text-[var(--color-text-muted)]">{playbook.rules.notes}</p> : null}
            </section>

            {playbook.checklist?.length ? (
              <section className="dash-card p-4">
                <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Criteria to follow</h2>
                <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--color-text-secondary)]">
                  {playbook.checklist.map((item) => (
                    <li key={item.id || item.label} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-text-muted)]" aria-hidden />
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="dash-card p-4">
              <h2 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Associated trades</h2>
              {!related.length ? (
                <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
                  No trades linked to this playbook in the selected range. Assign this playbook on a trade to start tracking.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--color-border-subtle)]">
                  {related.slice(0, 25).map((trade) => (
                    <li key={trade.id}>
                      <Link
                        href={`/trades/${trade.id}`}
                        className="flex items-center justify-between py-2 text-[12px] transition-colors hover:bg-[var(--color-primary-very-light)]"
                      >
                        <span className="font-medium text-[var(--color-text-primary)]">{trade.symbol}</span>
                        <span className="text-[var(--color-text-muted)]">{trade.opened_at.slice(0, 10)}</span>
                        <span className="tabular-nums">
                          <TradePnl trade={trade} displayPnl={displayPnl} formatMoney={formatMoney} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
      {playbook ? (
        <PlaybookFormModal
          open={editing}
          title="Edit playbook"
          initial={playbook}
          submitting={update.isPending}
          onClose={() => setEditing(false)}
          onSubmit={async (data) => {
            try {
              await update.mutateAsync({ id: playbook.id, data });
              toast.success("Playbook updated");
              setEditing(false);
            } catch {
              toast.error("Couldn’t save playbook");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function TradePnl({
  trade,
  displayPnl,
  formatMoney,
}: {
  trade: Trade;
  displayPnl: DisplayPnlFn;
  formatMoney: MoneyFormatter;
}) {
  const pnl = displayPnl(trade.pnl, trade.fees);
  return <>{pnl == null ? "—" : formatMetricValue(pnl, "currency", formatMoney)}</>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-card p-3">
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function Rule({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</h3>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] text-[var(--color-text-secondary)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
