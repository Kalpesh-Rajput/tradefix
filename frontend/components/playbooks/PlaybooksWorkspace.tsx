"use client";

import { BookOpen, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { CreatePlaybookModal } from "@/components/playbooks/CreatePlaybookModal";
import { MyPlaybooksView } from "@/components/playbooks/MyPlaybooksView";
import { PlaybookFormModal } from "@/components/playbooks/PlaybookFormModal";
import { PlaybookTemplateCard } from "@/components/playbooks/PlaybookTemplateCard";
import { PlaybooksHeader } from "@/components/playbooks/PlaybooksHeader";
import { TemplateDetailModal } from "@/components/playbooks/TemplateDetailModal";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import {
  useClonePlaybookTemplate,
  useCreatePlaybook,
  useDeletePlaybook,
  usePlaybookTemplates,
  usePlaybooks,
  useUpdatePlaybook,
} from "@/lib/hooks/usePlaybooks";
import { useTrades } from "@/lib/hooks/useTrades";
import { templatePerformance } from "@/lib/playbooks/stats";
import type { PlaybookCreateInput, PlaybookTemplate, UserPlaybook } from "@/lib/playbooks/types";
import { filterReportTrades } from "@/lib/reports/filter";
import type { DisplayPnlFn } from "@/lib/reports/types";
import { TRADE_LIST_LIMIT } from "@/lib/trades/limits";
import type { Trade } from "@/lib/types";

export function PlaybooksWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "templates" ? "templates" : "mine";
  const query = searchParams.get("q") ?? "";
  const toast = useToast();
  const { dateKey } = useLocale();
  const { activeAccount, formatMoney, displayPnl } = useAccountPrefs();
  const { openFlow } = useAddTradeModal();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [view, setView] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem("tradefix_playbooks_view") === "grid" ? "grid" : "list";
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserPlaybook | null>(null);
  const [detail, setDetail] = useState<PlaybookTemplate | null>(null);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserPlaybook | null>(null);

  const templatesQuery = usePlaybookTemplates();
  const playbooksQuery = usePlaybooks();
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

  const create = useCreatePlaybook();
  const clone = useClonePlaybookTemplate();
  const update = useUpdatePlaybook();
  const remove = useDeletePlaybook();

  const playbooks = playbooksQuery.data ?? [];
  const templates = templatesQuery.data ?? [];
  const addedSlugs = useMemo(
    () => new Set(playbooks.map((p) => p.source_template_slug).filter(Boolean) as string[]),
    [playbooks]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const hay = [t.title, t.description, t.creator_name, ...(t.categories ?? []), ...(t.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [templates, query]);

  function setTab(next: "mine" | "templates") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "mine") params.delete("tab");
    else params.set("tab", "templates");
    const qs = params.toString();
    router.replace(qs ? `/playbooks?${qs}` : "/playbooks", { scroll: false });
  }

  function setQuery(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "templates");
    if (next) params.set("q", next);
    else params.delete("q");
    router.replace(`/playbooks?${params.toString()}`, { scroll: false });
  }

  async function addTemplate(template: PlaybookTemplate) {
    if (addedSlugs.has(template.slug) || pendingSlug) return;
    setPendingSlug(template.slug);
    try {
      await clone.mutateAsync(template.slug);
      toast.success("Playbook added to My Playbooks");
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409;
      toast.error(conflict ? "This template is already in My Playbooks" : "Couldn’t add playbook");
    } finally {
      setPendingSlug(null);
    }
  }

  async function saveForm(data: PlaybookCreateInput) {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data });
        toast.success("Playbook updated");
      } else {
        await create.mutateAsync(data);
        toast.success("Playbook created");
      }
      setFormOpen(false);
      setEditing(null);
      setCreateOpen(false);
    } catch {
      toast.error("Couldn’t save playbook");
    }
  }

  const isDemo = activeAccount?.source === "dummy";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--color-background)]">
      <PlaybooksHeader
        dateFrom={dateFrom}
        dateTo={dateTo}
        onRangeChange={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
        <div className="flex h-11 shrink-0 items-center gap-1 border-b border-[var(--color-border)]">
          <TabButton active={tab === "mine"} onClick={() => setTab("mine")} icon={<BookOpen className="h-3.5 w-3.5" />}>
            My playbooks
          </TabButton>
          <TabButton active={tab === "templates"} onClick={() => setTab("templates")} icon={<Search className="h-3.5 w-3.5" />}>
            Templates
          </TabButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {isDemo ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                <span className="mr-2 inline-flex rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Demo
                </span>
                You are currently viewing demo trades. Ready to add your own trades?
              </p>
              <Button type="button" size="sm" onClick={() => openFlow()}>
                Add trades
              </Button>
            </div>
          ) : null}

          {tradesTruncated ? (
            <p className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[12px] text-[var(--color-text-secondary)]">
              Playbook stats use the latest {TRADE_LIST_LIMIT.toLocaleString()} trades in this range.
            </p>
          ) : null}

          {tab === "mine" ? (
            playbooksQuery.isLoading ? (
              <Skeleton className="h-64 rounded-[12px]" />
            ) :             playbooksQuery.isError ? (
              <ErrorCard message="Unable to load playbooks." onRetry={() => playbooksQuery.refetch()} />
            ) : (
              <MyPlaybooksView
                playbooks={playbooks}
                trades={reportTrades}
                displayPnl={displayPnl}
                formatMoney={formatMoney}
                view={view}
                onView={(next) => {
                  setView(next);
                  window.localStorage.setItem("tradefix_playbooks_view", next);
                }}
                onCreate={() => setCreateOpen(true)}
                onBrowse={() => setTab("templates")}
                onEdit={(pb) => {
                  setEditing(pb);
                  setFormOpen(true);
                }}
                onDuplicate={async (pb) => {
                  try {
                    await create.mutateAsync({
                      name: `${pb.name} copy`,
                      description: pb.description,
                      icon: pb.icon,
                      categories: pb.categories,
                      tags: pb.tags,
                      rules: pb.rules,
                      checklist: pb.checklist.map((i) => ({ label: i.label })),
                    });
                    toast.success("Playbook duplicated");
                  } catch {
                    toast.error("Couldn’t duplicate playbook");
                  }
                }}
                onDelete={setConfirmDelete}
              />
            )
          ) : (
            <TemplatesPane
              loading={templatesQuery.isLoading}
              error={templatesQuery.isError}
              onRetry={() => templatesQuery.refetch()}
              query={query}
              onQuery={setQuery}
              templates={filtered}
              playbooks={playbooks}
              trades={reportTrades}
              displayPnl={displayPnl}
              addedSlugs={addedSlugs}
              pendingSlug={pendingSlug}
              onOpen={setDetail}
              onAdd={addTemplate}
            />
          )}
        </div>
      </div>

      <CreatePlaybookModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onScratch={() => {
          setEditing(null);
          setCreateOpen(false);
          setFormOpen(true);
        }}
        onBrowse={() => {
          setCreateOpen(false);
          setTab("templates");
        }}
      />
      <PlaybookFormModal
        open={formOpen}
        title={editing ? "Edit playbook" : "Create playbook"}
        initial={editing ?? undefined}
        submitting={create.isPending || update.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={saveForm}
      />
      <TemplateDetailModal
        template={detail}
        added={detail ? addedSlugs.has(detail.slug) : false}
        adding={detail ? pendingSlug === detail.slug : false}
        onClose={() => setDetail(null)}
        onAdd={() => detail && addTemplate(detail)}
        onView={() => {
          const match = playbooks.find((p) => p.source_template_slug === detail?.slug);
          if (match) router.push(`/playbooks/${match.id}`);
        }}
      />
      {confirmDelete ? (
        <ConfirmDelete
          name={confirmDelete.name}
          pending={remove.isPending}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(confirmDelete.id);
              toast.success("Playbook deleted");
              setConfirmDelete(null);
            } catch {
              toast.error("Couldn’t delete playbook");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function TemplatesPane({
  loading,
  error,
  onRetry,
  query,
  onQuery,
  templates,
  playbooks,
  trades,
  displayPnl,
  addedSlugs,
  pendingSlug,
  onOpen,
  onAdd,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  query: string;
  onQuery: (v: string) => void;
  templates: PlaybookTemplate[];
  playbooks: UserPlaybook[];
  trades: Trade[];
  displayPnl: DisplayPnlFn;
  addedSlugs: Set<string>;
  pendingSlug: string | null;
  onOpen: (t: PlaybookTemplate) => void;
  onAdd: (t: PlaybookTemplate) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[320px] rounded-[12px]" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorCard message="Unable to load playbook templates." onRetry={onRetry} />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Playbook templates</h2>
          <p className="mt-1 max-w-xl text-[13px] text-[var(--color-text-muted)]">
            Choose from starter templates or build your own to keep your process consistent.
          </p>
        </div>
        <label className="relative w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search"
            className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-8 pr-3 text-[13px] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>
      {!templates.length ? (
        <div className="dash-card px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
          No playbook templates found. Try a different search.
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => onQuery("")}>
              Reset search
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const userCopy = playbooks.find((p) => p.source_template_slug === template.slug);
            return (
              <PlaybookTemplateCard
                key={template.id}
                template={template}
                stats={templatePerformance(trades, userCopy, displayPnl)}
                added={addedSlugs.has(template.slug)}
                adding={pendingSlug === template.slug}
                onOpen={() => onOpen(template)}
                onAdd={() => onAdd(template)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-11 items-center gap-1.5 px-2.5 text-[13px] font-medium ${
        active ? "text-primary" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {icon}
      {children}
      {active ? <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-primary" /> : null}
    </button>
  );
}

function ErrorCard({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="dash-card border-destructive/30 bg-destructive/5 px-4 py-6 text-sm">
      {message || "Unable to load playbooks."}{" "}
      <button type="button" onClick={onRetry} className="text-primary hover:underline">
        Retry
      </button>
    </div>
  );
}

function ConfirmDelete({
  name,
  pending,
  onCancel,
  onConfirm,
}: {
  name: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-[400px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Delete playbook?</h2>
        <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">
          This will remove <span className="font-medium">{name}</span> from your account.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="danger" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
