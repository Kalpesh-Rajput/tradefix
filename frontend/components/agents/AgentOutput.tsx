"use client";

import Link from "next/link";

import type { AgentOutput as AgentOutputData } from "@/lib/types";

export function AgentOutput({ output }: { output: AgentOutputData | null | undefined }) {
  if (!output) return null;
  const findings = output.findings ?? [];
  const metrics = output.metrics ?? [];
  const actions = output.actions ?? [];

  return (
    <div className="space-y-4">
      {output.summary ? (
        <p className="text-[14px] leading-6 text-[var(--color-text-primary)]">{output.summary}</p>
      ) : null}
      {metrics.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-[var(--color-border)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{metric.label}</p>
              <p className="mt-1 text-[13px] font-semibold text-[var(--color-text-primary)]">{metric.value}</p>
              {metric.sample_size ? (
                <p className="text-[10px] text-[var(--color-text-tertiary)]">
                  {metric.sample_size} trades{metric.period ? ` · ${metric.period}` : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {findings.length > 0 ? (
        <ul className="space-y-3">
          {findings.map((finding) => (
            <li key={finding.text} className="rounded-lg border border-[var(--color-border)] px-3 py-3">
              <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{finding.text}</p>
              <ul className="mt-2 space-y-1">
                {(finding.evidence ?? []).map((item) => (
                  <li key={item} className="text-[12px] leading-5 text-[var(--color-text-secondary)]">
                    {item}
                  </li>
                ))}
              </ul>
              {finding.impact ? (
                <p className="mt-2 text-[12px] font-medium text-[var(--color-text-primary)]">{finding.impact}</p>
              ) : null}
              <ActionRow actions={finding.actions ?? []} />
            </li>
          ))}
        </ul>
      ) : null}
      <ActionRow actions={actions} />
      {(output.warnings ?? []).length > 0 ? (
        <ul className="space-y-1 text-[12px] text-amber-700 dark:text-amber-300">
          {output.warnings?.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {(output.changes ?? []).length > 0 ? (
        <ul className="text-[12px] text-[var(--color-text-tertiary)]">
          {output.changes?.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ActionRow({ actions }: { actions: { label: string; href: string }[] }) {
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Link
          key={`${action.label}-${action.href}`}
          href={action.href}
          className="inline-flex h-7 items-center rounded-md border border-[var(--color-border)] px-2.5 text-[11px] font-medium text-primary hover:bg-[var(--color-primary-very-light)]"
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}
