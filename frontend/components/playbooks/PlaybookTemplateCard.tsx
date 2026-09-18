"use client";

import { Check, Plus } from "lucide-react";

import { TemplatePreview } from "@/components/playbooks/TemplatePreview";
import { CATEGORY_LABEL } from "@/lib/playbooks/types";
import type { PlaybookPerformance } from "@/lib/playbooks/stats";
import type { PlaybookTemplate } from "@/lib/playbooks/types";

export function PlaybookTemplateCard({
  template,
  stats,
  added,
  adding,
  onOpen,
  onAdd,
}: {
  template: PlaybookTemplate;
  stats: PlaybookPerformance;
  added: boolean;
  adding?: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <article className="dash-card flex h-full min-w-0 flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        {template.preview_image ? (
          <div className="relative aspect-video w-full overflow-hidden bg-[var(--color-surface-secondary)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={template.preview_image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          </div>
        ) : (
          <TemplatePreview icon={template.icon} title={template.title} />
        )}
      </button>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="line-clamp-2 min-h-[40px] text-[13px] font-semibold text-[var(--color-text-primary)]">
            {template.icon ? `${template.icon} ` : ""}
            {template.title}
          </h3>
        </button>
        <div className="mt-2 flex flex-wrap gap-1">
          {template.categories.slice(0, 3).map((id) => (
            <span
              key={id}
              className="rounded-md bg-[var(--color-surface-secondary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]"
            >
              {CATEGORY_LABEL[id] ?? id}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          {added ? (
            <>
              <Stat label="Win rate" value={`${stats.winRate.toFixed(stats.winRate % 1 ? 1 : 0)}%`} />
              <Stat label="Trades" value={String(stats.wins + stats.losses + stats.be)} />
              <Stat label="Win/Loss" value={stats.winLoss} />
            </>
          ) : (
            <p className="col-span-3 text-[11px] text-[var(--color-text-muted)]">
              Add this template to track live performance from your trades.
            </p>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary-very-light)] text-[10px] font-semibold text-primary">
              {(template.creator_name[0] || "S").toUpperCase()}
            </span>
            <span className="truncate text-[11px] text-[var(--color-text-secondary)]">{template.creator_name}</span>
          </div>
          <button
            type="button"
            disabled={added || adding}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={added ? `${template.title} already in My Playbooks` : `Add ${template.title} to My Playbooks`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-primary/40 hover:bg-[var(--color-primary-very-light)] hover:text-primary disabled:opacity-60"
          >
            {added ? <Check className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
