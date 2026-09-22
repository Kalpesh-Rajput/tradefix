"use client";

import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  Copy,
  ExternalLink,
  Hash,
  Lightbulb,
  Newspaper,
  Pencil,
  RefreshCw,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Fragment } from "react";

import { AiMark } from "@/components/ai/AiMark";
import { extractStats, shapeAnswer, sourceHref, sourceLabel, statKind, valueTone, type StatKind } from "@/components/ai/format";
import type { ThreadMessage } from "@/components/ai/types";
import type { AiSource } from "@/lib/types";

export function UserMessage({
  text,
  onEdit,
  appearance = "page",
}: {
  text: string;
  onEdit?: () => void;
  appearance?: "page" | "panel";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex items-start justify-end gap-1.5"
    >
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit message"
          title="Edit"
          className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[var(--color-text-tertiary)] opacity-100 transition hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
      <div
        className={
          appearance === "panel"
            ? "max-w-[min(100%,18rem)] rounded-2xl rounded-br-md bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-surface))] px-3 py-2 text-[13px] leading-5 text-[var(--color-text-primary)]"
            : "max-w-[min(100%,34rem)] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[14px] leading-5 text-white text-on-accent"
        }
      >
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </motion.div>
  );
}

const actionBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]";

export function AssistantMessage({
  message,
  onRetry,
  onCopy,
  onRegenerate,
  onReact,
  followUps,
  onFollowUp,
  appearance = "page",
}: {
  message: ThreadMessage;
  onRetry?: () => void;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onReact?: (reaction: "up" | "down") => void;
  followUps?: string[];
  onFollowUp?: (question: string) => void;
  appearance?: "page" | "panel";
}) {
  const reduce = useReducedMotion();
  const shaped = message.error ? null : shapeAnswer(message.text);
  const stats = message.error || shaped?.kind === "briefing" ? [] : extractStats(message.text);
  const reflectionInBody = new Set((shaped?.reflection ?? []).map((item) => item.toLowerCase()));
  const body = message.text.toLowerCase();
  const extraActions = (message.actions ?? []).filter((action) => {
    const key = action.toLowerCase();
    return !reflectionInBody.has(key) && !body.includes(key);
  });

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2.5"
    >
      <AiMark size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">TradeFix AI</p>
        {message.error ? (
          <div className="mt-1.5 rounded-2xl border border-[var(--color-danger-light)] bg-[var(--color-danger-bg)] px-4 py-3">
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Something went wrong</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--color-text-secondary)]">{message.text}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[12px] font-semibold text-white text-on-accent transition hover:bg-primary-hover"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {stats.length > 0 ? <StatChips chips={stats} /> : null}
            <div
              className={
                appearance === "panel"
                  ? "mt-1"
                  : "mt-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3"
              }
            >
              {shaped?.kind === "briefing" ? <Briefing answer={shaped} /> : <AiMarkdown text={message.text} />}
            </div>
            {appearance === "page" && shaped?.kind !== "briefing" && extraActions.length > 0 ? (
              <div className="mt-3">
                <SectionLabel emoji="🎯" label="Next" />
                <ul className="mt-2 space-y-1.5">
                  {extraActions.map((action) => (
                    <li key={action} className="flex gap-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {message.sources && message.sources.length > 0 ? <SourceList sources={message.sources} /> : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {onCopy ? (
                <button type="button" onClick={onCopy} aria-label="Copy answer" title="Copy" className={actionBtn}>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              ) : null}
              {onRegenerate ? (
                <button type="button" onClick={onRegenerate} aria-label="Regenerate answer" title="Regenerate" className={actionBtn}>
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              ) : null}
              {onReact ? (
                <>
                  <button
                    type="button"
                    onClick={() => onReact("up")}
                    aria-label="Helpful"
                    aria-pressed={message.reaction === "up"}
                    title="Helpful"
                    className={clsx(actionBtn, message.reaction === "up" && "border-primary/40 bg-[var(--color-primary-very-light)] text-primary")}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReact("down")}
                    aria-label="Not helpful"
                    aria-pressed={message.reaction === "down"}
                    title="Not helpful"
                    className={clsx(actionBtn, message.reaction === "down" && "border-primary/40 bg-[var(--color-primary-very-light)] text-primary")}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </>
              ) : null}
            </div>
            {followUps && followUps.length > 0 && onFollowUp ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {followUps.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => onFollowUp(question)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-left text-[12px] font-medium text-[var(--color-text-secondary)] transition hover:border-primary/30 hover:text-primary"
                  >
                    {question}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </motion.article>
  );
}

const STAT_ICONS: Record<StatKind, LucideIcon> = {
  pnl: TrendingUp,
  loss: TrendingDown,
  win: Target,
  count: Hash,
  average: BarChart3,
  general: BarChart3,
};

function Briefing({ answer }: { answer: { stats: { label: string; value: string }[]; paragraphs: string[]; reflection: string[] } }) {
  return (
    <div className="space-y-3">
      {answer.stats.length > 0 ? (
        <section>
          <SectionLabel emoji="📊" label="Snapshot" />
          <ul className="mt-2 space-y-1.5">
            {answer.stats.map((item) => (
              <StatRow key={item.label} label={item.label} value={item.value} />
            ))}
          </ul>
        </section>
      ) : null}
      {answer.paragraphs.length > 0 ? (
        <section className={answer.stats.length > 0 ? "border-t border-[var(--color-border)] pt-3" : undefined}>
          <SectionLabel emoji="💡" label="What this means" />
          <div className="mt-1.5 space-y-2 text-[14px] leading-6 text-[var(--color-text-secondary)]">
            {answer.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}
      {answer.reflection.length > 0 ? (
        <section className="border-t border-[var(--color-border)] pt-3">
          <SectionLabel emoji="🎯" label="Next" />
          <ul className="mt-2 space-y-1.5">
            {answer.reflection.map((item) => (
              <li key={item} className="flex gap-2 text-[13px] leading-5 text-[var(--color-text-secondary)]">
                <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SectionLabel({ emoji, label }: { emoji: string; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-text-primary)]">
      <span aria-hidden>{emoji}</span>
      {label}
    </p>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  const kind = statKind(label);
  const signed = valueTone(value);
  const tone = signed !== "neutral" ? signed : kind === "loss" ? "down" : "neutral";
  const Icon = kind === "pnl" && tone === "down" ? TrendingDown : kind === "loss" ? TrendingDown : STAT_ICONS[kind];
  return (
    <li
      className={clsx(
        "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
        tone === "up" && "bg-positive-soft",
        tone === "down" && "bg-negative-soft",
        tone === "neutral" && "bg-[var(--color-primary-very-light)]"
      )}
    >
      <span
        className={clsx(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface)]",
          tone === "up" && "text-positive",
          tone === "down" && "text-negative",
          tone === "neutral" && "text-primary"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-[12px] leading-4 text-[var(--color-text-secondary)]">{label}</span>
      <span
        className={clsx(
          "shrink-0 text-right text-[14px] font-semibold tabular-nums",
          tone === "up" && "text-positive",
          tone === "down" && "text-negative",
          tone === "neutral" && "text-[var(--color-text-primary)]"
        )}
      >
        {value}
      </span>
    </li>
  );
}

function StatChips({ chips }: { chips: { label: string; value: string }[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {chips.map((chip) => (
        <StatRow key={chip.label} label={chip.label} value={chip.value} />
      ))}
    </ul>
  );
}

function SourceList({ sources }: { sources: AiSource[] }) {
  const web = sources.filter((source) => source.type.toLowerCase() === "web" && source.url);
  const local = sources.filter((source) => source.type.toLowerCase() !== "web");
  return (
    <div className="mt-3 space-y-3">
      {web.length > 0 ? <WebResources sources={web} /> : null}
      {local.length > 0 ? <LocalSources sources={local} /> : null}
    </div>
  );
}

function WebResources({ sources }: { sources: AiSource[] }) {
  return (
    <section>
      <SectionLabel emoji="📰" label="From the web" />
      <ul className="mt-2 space-y-2">
        {sources.map((source) => {
          const href = sourceHref(source);
          const when = source.date?.slice(0, 10);
          const meta = [source.publisher, when].filter(Boolean).join(" · ");
          const body = (
            <>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-very-light)] text-primary">
                <Newspaper className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold leading-5 text-[var(--color-text-primary)]">{source.title}</span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]" strokeWidth={2} />
                </span>
                {meta ? <span className="mt-0.5 block text-[11px] text-[var(--color-text-tertiary)]">{meta}</span> : null}
                {source.snippet ? (
                  <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-[var(--color-text-secondary)]">{source.snippet}</span>
                ) : null}
              </span>
            </>
          );
          const className =
            "flex gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2.5 transition hover:border-primary/30";
          if (!href) {
            return (
              <li key={source.id} className={className}>
                {body}
              </li>
            );
          }
          return (
            <li key={source.id}>
              <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                {body}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LocalSources({ sources }: { sources: AiSource[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        Based on
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {sources.map((source) => {
          const href = sourceHref(source);
          const label = sourceLabel(source);
          const className =
            "inline-flex max-w-full items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition duration-150 hover:-translate-y-px hover:border-primary/30 hover:text-primary";
          if (href) {
            return (
              <Link key={`${source.type}-${source.id}`} href={href} className={className} title={label}>
                <span className="truncate">{label}</span>
              </Link>
            );
          }
          return (
            <span key={`${source.type}-${source.id}`} className={className} title={label}>
              <span className="truncate">{label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function AiMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2.5 text-[14px] leading-6 text-[var(--color-text-secondary)]">
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) {
      blocks.push({ type: "heading", text: line.replace(/^#{1,3}\s+/, "").trim() });
      i += 1;
      continue;
    }
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const parsed = parseTable(tableLines);
      if (parsed) blocks.push(parsed);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) && !/^\s*\*\*/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]) && !/^\s*\*\*/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const para: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^#{1,3}\s+/.test(lines[i]) && !(/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\*\*/.test(lines[i])) && !/^\s*\d+[.)]\s+/.test(lines[i]) && !lines[i].trim().startsWith("|")) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }
  return blocks;
}

function parseTable(lines: string[]): Block | null {
  const cells = lines
    .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
    )
    .filter((row) => row.some((cell) => cell.length > 0));
  if (cells.length < 2) return null;
  return { type: "table", headers: cells[0], rows: cells.slice(1) };
}

function renderBlock(block: Block): ReactNode {
  if (block.type === "heading") {
    return (
      <h3 className="flex items-center gap-1.5 pt-1 text-[13px] font-semibold tracking-tight text-[var(--color-text-primary)]">
        <Lightbulb className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
        {inline(block.text)}
      </h3>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="space-y-1.5">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
            <span>{inline(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "ol") {
    return (
      <ol className="list-decimal space-y-1 pl-4">
        {block.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ol>
    );
  }
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[240px] border-collapse text-left text-[12px]">
          <thead>
            <tr>
              {block.headers.map((cell) => (
                <th key={cell} className="border-b border-[var(--color-border)] px-2 py-1.5 font-semibold text-[var(--color-text-primary)]">
                  {inline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={`${ri}-${ci}`} className="border-b border-[var(--color-border-subtle)] px-2 py-1.5 tabular-nums">
                    {inline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap">{inline(block.text)}</p>;
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
          {bold[1]}
        </strong>
      );
    }
    return <Fragment key={i}>{part.replace(/\*\*/g, "")}</Fragment>;
  });
}
