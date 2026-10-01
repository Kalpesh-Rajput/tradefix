"use client";

import clsx from "clsx";
import { Bot, LineChart, Newspaper, Plus, Tags, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AgentOutput } from "@/components/agents/AgentOutput";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import {
  useAgentRun,
  useAgentRuns,
  useAgentTemplates,
  useCreateAgent,
  useDeleteAgent,
  useRetryAgentRun,
  useRunAgent,
  useUpdateAgent,
  useUserAgents,
} from "@/lib/hooks/useAgents";
import type { AgentTemplate, UserAgent } from "@/lib/types";

const PROGRESS: Record<string, string> = {
  market_briefing: "Reading headlines and your day plan…",
  trade_tagger: "Reviewing imported trades…",
  session_review: "Checking rule adherence…",
};

function when(value: string | null | undefined) {
  if (!value) return "Not run yet";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function triggerLabel(trigger: string) {
  const labels: Record<string, string> = {
    manual: "Manual",
    start_my_day: "Start My Day",
    day_view: "Day View",
    after_import: "After import",
    after_session: "After session",
  };
  return labels[trigger] ?? trigger;
}

function statusDot(status: string | null, running: boolean) {
  if (running || status === "running") return "bg-primary";
  if (status === "failed") return "bg-rose-500";
  if (status === "partial" || status === "paused") return "bg-amber-500";
  if (status === "active" || status === "completed" || status === "success") return "bg-emerald-500";
  return "bg-[var(--color-text-tertiary)]";
}

export function AgentsWorkspace({ createKey, initialRunId }: { createKey?: string | null; initialRunId?: string | null }) {
  const toast = useToast();
  const templates = useAgentTemplates();
  const agents = useUserAgents();
  const runs = useAgentRuns();
  const update = useUpdateAgent();
  const runAgent = useRunAgent();
  const [configAgent, setConfigAgent] = useState<UserAgent | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(createKey ?? null);
  const [runId, setRunId] = useState<string | null>(initialRunId ?? null);

  useEffect(() => {
    if (createKey) setDraftKey(createKey);
  }, [createKey]);

  const configured = agents.data ?? [];
  const catalog = templates.data ?? [];
  const activeCount = configured.filter((agent) => agent.status === "active").length;
  const recent = (runs.data ?? []).slice(0, 4);
  const owned = new Set(configured.map((agent) => agent.template_key));
  const available = catalog.filter((item) => item.implemented && !owned.has(item.key));
  const soon = catalog.filter((item) => item.coming_soon);

  async function toggle(agent: UserAgent) {
    try {
      await update.mutateAsync({ id: agent.id, body: { status: agent.status === "active" ? "paused" : "active" } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t update the agent");
    }
  }

  async function runNow(agent: UserAgent) {
    try {
      const result = await runAgent.mutateAsync({ id: agent.id, trigger: "manual" });
      setRunId(result.id);
      if (result.status === "failed") toast.error(result.error || "Agent failed");
      else toast.success(result.message || "Agent finished");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Agent failed");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--color-text-primary)]">TradeFix Agents</h1>
          <p className="mt-1 max-w-xl text-[14px] leading-6 text-[var(--color-text-secondary)]">
            AI agents that work for your trading automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-[12px] text-[var(--color-text-tertiary)]">
            <p>{activeCount} active</p>
            <p>{recent.length} recent runs</p>
          </div>
          <button
            type="button"
            onClick={() => setDraftKey(available[0]?.key ?? "market_briefing")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover"
          >
            <Plus className="h-4 w-4" />
            Create Agent
          </button>
        </div>
      </header>

      {configured.length === 0 ? (
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8">
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Let TradeFiz work for you.</h2>
          <p className="mt-2 max-w-lg text-[13px] leading-6 text-[var(--color-text-secondary)]">
            Create an AI agent that watches your trades, reviews your sessions, and turns your trading data into useful actions.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Active agents</h2>
          <div className="grid gap-3">
            {configured.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                running={runAgent.isPending && runAgent.variables?.id === agent.id}
                onToggle={() => void toggle(agent)}
                onRun={() => void runNow(agent)}
                onConfigure={() => setConfigAgent(agent)}
                onHistory={() => {
                  const last = (runs.data ?? []).find((run) => run.user_agent_id === agent.id);
                  if (last) setRunId(last.id);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Recent agent activity</h2>
          <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            {recent.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setRunId(run.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-primary-very-light)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                    {catalog.find((item) => item.key === run.agent_name)?.name ?? run.agent_name}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--color-text-tertiary)]">{run.message || run.status}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">{when(run.completed_at || run.run_at)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Available agents</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {available.map((template) => (
            <TemplateCard key={template.key} template={template} onCreate={() => setDraftKey(template.key)} />
          ))}
          {soon.map((template) => (
            <TemplateCard key={template.key} template={template} />
          ))}
        </div>
      </section>

      {configAgent ? (
        <ConfigDrawer
          agent={configAgent}
          onClose={() => setConfigAgent(null)}
          onOpenRun={() => {
            const last = (runs.data ?? []).find((run) => run.user_agent_id === configAgent.id);
            if (last) setRunId(last.id);
          }}
        />
      ) : null}
      {draftKey ? <CreateDrawer templateKey={draftKey} templates={catalog} onClose={() => setDraftKey(null)} /> : null}
      {runId ? <RunDrawer runId={runId} templates={catalog} onClose={() => setRunId(null)} /> : null}
    </div>
  );
}

function AgentCard({
  agent,
  running,
  onToggle,
  onRun,
  onConfigure,
  onHistory,
}: {
  agent: UserAgent;
  running: boolean;
  onToggle: () => void;
  onRun: () => void;
  onConfigure: () => void;
  onHistory: () => void;
}) {
  const Icon = agent.template_key === "trade_tagger" ? Tags : agent.template_key === "session_review" ? LineChart : Newspaper;
  const live = running || agent.last_status === "running";
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-primary/30">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-very-light)] text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{agent.name}</h3>
              <p className="text-[12px] text-[var(--color-text-tertiary)]">{agent.category}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={agent.status === "active"}
              onClick={onToggle}
              className={clsx(
                "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                agent.status === "active" ? "bg-primary" : "bg-[var(--color-border)]"
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                  agent.status === "active" ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">{agent.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agent.trigger_types.map((trigger) => (
              <span key={trigger} className="rounded-full bg-[var(--color-primary-very-light)] px-2 py-0.5 text-[11px] text-primary">
                {triggerLabel(trigger)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
            <span className={clsx("h-1.5 w-1.5 rounded-full", statusDot(live ? "running" : agent.status, live))} />
            {live ? "Running" : agent.status === "active" ? "Active" : "Paused"}
            <span className="text-[var(--color-text-tertiary)]">· Last run {when(agent.last_run_at)}</span>
          </div>
          {agent.last_summary ? <p className="mt-2 text-[13px] text-[var(--color-text-primary)]">{agent.last_summary}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={agent.status !== "active" || running}
              onClick={onRun}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover disabled:opacity-50"
            >
              {running ? PROGRESS[agent.template_key] || "Working…" : "Run now"}
            </button>
            <button
              type="button"
              onClick={onConfigure}
              className="inline-flex h-8 items-center rounded-md border border-[var(--color-border)] px-3 text-[12px] font-medium hover:bg-[var(--color-primary-very-light)]"
            >
              Configure
            </button>
            <button type="button" onClick={onHistory} className="inline-flex h-8 items-center px-2 text-[12px] text-primary">
              Run history
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function TemplateCard({ template, onCreate }: { template: AgentTemplate; onCreate?: () => void }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{template.name}</h3>
      </div>
      <p className="mt-2 flex-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{template.description}</p>
      <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">{template.category}</p>
      {template.coming_soon ? (
        <p className="mt-3 text-[12px] font-medium text-[var(--color-text-tertiary)]">Coming soon</p>
      ) : (
        <button type="button" onClick={onCreate} className="mt-3 inline-flex h-8 items-center text-[12px] font-semibold text-primary">
          Create Agent
        </button>
      )}
    </article>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30" role="dialog" aria-modal="true">
      <button type="button" className="hidden flex-1 sm:block" aria-label="Close" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
          <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-[var(--color-primary-very-light)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function ConfigDrawer({ agent, onClose, onOpenRun }: { agent: UserAgent; onClose: () => void; onOpenRun: () => void }) {
  const toast = useToast();
  const update = useUpdateAgent();
  const remove = useDeleteAgent();
  const [instructions, setInstructions] = useState(agent.instructions);
  const [triggers, setTriggers] = useState(agent.trigger_types);
  const [symbols, setSymbols] = useState((agent.configuration.symbols ?? []).join(", "));
  const [news, setNews] = useState(agent.configuration.include_news !== false);
  const [events, setEvents] = useState(agent.configuration.include_events !== false);
  const [performance, setPerformance] = useState(agent.configuration.include_performance !== false);
  const [mode, setMode] = useState(agent.configuration.mode ?? "suggest");

  async function save() {
    const configuration =
      agent.template_key === "market_briefing"
        ? {
            symbols: symbols.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean),
            include_news: news,
            include_events: events,
            include_performance: performance,
          }
        : agent.template_key === "trade_tagger"
          ? { mode }
          : {};
    try {
      await update.mutateAsync({ id: agent.id, body: { instructions, trigger_types: triggers, configuration } });
      toast.success("Agent saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t save");
    }
  }

  return (
    <Drawer title={agent.name} onClose={onClose}>
      <p className="text-[13px] leading-5 text-[var(--color-text-secondary)]">{agent.description}</p>
      <TriggerPicker allowed={agent.trigger_types.concat(defaultTriggers(agent.template_key))} selected={triggers} onChange={setTriggers} />
      {agent.template_key === "market_briefing" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-medium">Symbols</label>
          <SymbolEditor value={symbols} onChange={setSymbols} />
          <Toggle label="Use market news" checked={news} onChange={setNews} />
          <Toggle label="Use economic events" checked={events} onChange={setEvents} />
          <Toggle label="Use recent performance" checked={performance} onChange={setPerformance} />
        </div>
      ) : null}
      {agent.template_key === "trade_tagger" ? (
        <label className="mt-4 block text-[13px]">
          <span className="mb-1 block text-[12px] font-medium">Tag behavior</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as "suggest" | "apply")} className="h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 text-[13px]">
            <option value="suggest">Suggest for approval</option>
            <option value="apply">Auto apply high-confidence tags</option>
          </select>
        </label>
      ) : null}
      <label className="mt-4 block">
        <span className="mb-1 block text-[12px] font-medium">Instructions</span>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={4}
          placeholder="What should this agent focus on?"
          className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[13px]"
        />
      </label>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md border border-[var(--color-border)] px-3 text-[13px]">
          Cancel
        </button>
        <button type="button" onClick={() => void save()} className="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground text-on-accent">
          Save changes
        </button>
      </div>
      <button type="button" onClick={onOpenRun} className="mt-4 text-[12px] font-medium text-primary">
        View latest run
      </button>
      <button
        type="button"
        onClick={() => void remove.mutateAsync(agent.id).then(onClose)}
        className="mt-6 text-[12px] text-rose-600"
      >
        Delete agent
      </button>
    </Drawer>
  );
}

function CreateDrawer({ templateKey, templates, onClose }: { templateKey: string; templates: AgentTemplate[]; onClose: () => void }) {
  const create = useCreateAgent();
  const toast = useToast();
  const template = templates.find((item) => item.key === templateKey) ?? templates.find((item) => item.implemented);
  const [key, setKey] = useState(template?.key ?? templateKey);
  const chosen = templates.find((item) => item.key === key);
  const [instructions, setInstructions] = useState("");
  const [symbols, setSymbols] = useState("");
  const [mode, setMode] = useState<"suggest" | "apply">("suggest");

  async function save() {
    if (!chosen || !chosen.implemented) return;
    try {
      await create.mutateAsync({
        template_key: chosen.key,
        status: "active",
        trigger_types: chosen.triggers,
        instructions,
        configuration:
          chosen.key === "market_briefing"
            ? { symbols: symbols.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean), include_news: true, include_events: true, include_performance: true }
            : chosen.key === "trade_tagger"
              ? { mode }
              : {},
      });
      toast.success("Agent created");
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn’t create the agent");
    }
  }

  const choices = templates.filter((item) => item.implemented);
  return (
    <Drawer title="Create an agent" onClose={onClose}>
      <p className="text-[13px] text-[var(--color-text-secondary)]">Choose what TradeFix should do automatically.</p>
      <div className="mt-3 space-y-2">
        {choices.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setKey(item.key)}
            className={clsx(
              "w-full rounded-xl border px-3 py-3 text-left",
              key === item.key ? "border-primary bg-[var(--color-primary-very-light)]" : "border-[var(--color-border)]"
            )}
          >
            <span className="block text-[13px] font-semibold">{item.name}</span>
            <span className="mt-1 block text-[12px] text-[var(--color-text-secondary)]">{item.description}</span>
          </button>
        ))}
      </div>
      {key === "market_briefing" ? <div className="mt-4"><SymbolEditor value={symbols} onChange={setSymbols} /></div> : null}
      {key === "trade_tagger" ? (
        <select value={mode} onChange={(event) => setMode(event.target.value as "suggest" | "apply")} className="mt-4 h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 text-[13px]">
          <option value="suggest">Suggest for approval</option>
          <option value="apply">Auto apply high-confidence tags</option>
        </select>
      ) : null}
      <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} placeholder="Optional instructions" className="mt-3 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[13px]" />
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md border border-[var(--color-border)] px-3 text-[13px]">Cancel</button>
        <button type="button" onClick={() => void save()} className="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground text-on-accent">Save</button>
      </div>
    </Drawer>
  );
}

function RunDrawer({ runId, templates, onClose }: { runId: string; templates: AgentTemplate[]; onClose: () => void }) {
  const query = useAgentRun(runId);
  const retry = useRetryAgentRun();
  const run = query.data;
  const name = templates.find((item) => item.key === run?.agent_name)?.name ?? run?.agent_name;
  const started = run?.started_at ? new Date(run.started_at).getTime() : null;
  const ended = run?.completed_at ? new Date(run.completed_at).getTime() : null;
  const duration = started && ended ? `${Math.max(1, Math.round((ended - started) / 1000))}s` : "—";
  const context = run?.input_context ?? {};
  return (
    <Drawer title={name || "Run"} onClose={onClose}>
      {query.isLoading || !run ? (
        <p className="text-[13px] text-[var(--color-text-tertiary)]">Opening the run…</p>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 text-[12px]">
            <div><dt className="text-[var(--color-text-tertiary)]">Status</dt><dd className="font-medium">{run.status}</dd></div>
            <div><dt className="text-[var(--color-text-tertiary)]">Trigger</dt><dd className="font-medium">{triggerLabel(run.trigger || "manual")}</dd></div>
            <div><dt className="text-[var(--color-text-tertiary)]">Started</dt><dd>{when(run.started_at || run.run_at)}</dd></div>
            <div><dt className="text-[var(--color-text-tertiary)]">Duration</dt><dd>{duration}</dd></div>
            <div><dt className="text-[var(--color-text-tertiary)]">Trades analyzed</dt><dd>{String(context.trade_count ?? run.details?.trades_analyzed ?? "—")}</dd></div>
          </dl>
          {run.error ? <p className="text-[13px] text-rose-600">{run.error}</p> : null}
          <AgentOutput output={run.output} />
          {run.status === "failed" ? (
            <button
              type="button"
              onClick={() => void retry.mutateAsync(run.id)}
              className="h-8 rounded-md border border-[var(--color-border)] px-3 text-[12px] font-medium"
            >
              {retry.isPending ? "Retrying…" : "Retry"}
            </button>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

function SymbolEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState("");
  const symbols = value.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
  function commit(next: string[]) {
    onChange(next.join(", "));
  }
  function add() {
    const symbol = draft.trim().toUpperCase();
    setDraft("");
    if (!symbol || symbols.includes(symbol)) return;
    commit([...symbols, symbol].slice(0, 12));
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => commit(symbols.filter((item) => item !== symbol))}
            className="rounded-full bg-[var(--color-primary-very-light)] px-2 py-0.5 text-[12px] text-primary"
          >
            {symbol} ×
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Add symbol"
          className="h-9 min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 text-[13px]"
        />
        <button type="button" onClick={add} className="h-9 rounded-md border border-[var(--color-border)] px-3 text-[12px]">
          Add
        </button>
      </div>
    </div>
  );
}

function TriggerPicker({ allowed, selected, onChange }: { allowed: string[]; selected: string[]; onChange: (value: string[]) => void }) {
  const unique = useMemo(() => Array.from(new Set(allowed)), [allowed]);
  return (
    <div className="mt-4">
      <p className="text-[12px] font-medium">Triggers</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {unique.map((trigger) => {
          const on = selected.includes(trigger);
          return (
            <button
              key={trigger}
              type="button"
              onClick={() => onChange(on ? selected.filter((item) => item !== trigger) : [...selected, trigger])}
              className={clsx(
                "rounded-full px-2.5 py-1 text-[11px]",
                on ? "bg-primary text-primary-foreground text-on-accent" : "border border-[var(--color-border)]"
              )}
            >
              {triggerLabel(trigger)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-[13px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function defaultTriggers(key: string) {
  if (key === "market_briefing") return ["manual", "start_my_day"];
  if (key === "trade_tagger") return ["manual", "after_import"];
  return ["manual", "day_view", "after_session"];
}
