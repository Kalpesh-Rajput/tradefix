"use client";

import clsx from "clsx";
import { CalendarDays, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { NoteTemplateSelector } from "@/components/dayview/notes/NoteTemplateSelector";
import { RichNoteEditor } from "@/components/dayview/notes/RichNoteEditor";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { isNoteContentEmpty, renderTemplateHtml, type NoteTemplate } from "@/lib/day-notes/templates";
import { useDayNote, useUpsertDayNote } from "@/lib/hooks/useDayNotes";
import { useUpdateTrade } from "@/lib/hooks/useTrades";
import type { Trade } from "@/lib/types";

type NoteSubTab = "trade" | "journal";

export function NotesTab({ trade }: { trade: Trade }) {
  const [sub, setSub] = useState<NoteSubTab>("trade");
  const { dateKey } = useLocale();
  const date = dateKey(trade.opened_at);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-[#E2E2E7] bg-[#F7F7F9] p-0.5">
          <SubBtn active={sub === "trade"} onClick={() => setSub("trade")} icon="trade">
            Trade note
          </SubBtn>
          <SubBtn active={sub === "journal"} onClick={() => setSub("journal")} icon="journal">
            Daily Journal
          </SubBtn>
        </div>
      </div>
      {sub === "trade" ? <TradeNoteEditor trade={trade} /> : <DailyJournalPane accountId={trade.account_id} date={date} />}
    </div>
  );
}

function SubBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: "trade" | "journal";
  children: React.ReactNode;
}) {
  const Icon = icon === "trade" ? FileText : CalendarDays;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium",
        active
          ? "bg-white text-[var(--color-text-primary)] shadow-[inset_0_0_0_1px_#E8E8EC]"
          : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      )}
    >
      <Icon className={clsx("h-3.5 w-3.5", active ? "text-primary" : "")} strokeWidth={1.75} />
      {children}
    </button>
  );
}

function TradeNoteEditor({ trade }: { trade: Trade }) {
  const toast = useToast();
  const update = useUpdateTrade();
  const [html, setHtml] = useState(trade.notes ?? "");
  const [revision, setRevision] = useState(0);
  const [templateId, setTemplateId] = useState("");
  const baseline = useRef(trade.notes ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const next = trade.notes ?? "";
    setHtml(next);
    baseline.current = next;
    setRevision((n) => n + 1);
  }, [trade.id, trade.notes]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function scheduleSave(next: string) {
    setHtml(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(next);
    }, 700);
  }

  async function persist(next: string) {
    if (next === baseline.current) return;
    try {
      await update.mutateAsync({ id: trade.id, data: { notes: next } });
      baseline.current = next;
    } catch (err) {
      toast.error("Couldn’t save note", err instanceof Error ? err.message : undefined);
    }
  }

  function applyTemplate(template: NoteTemplate) {
    if (!isNoteContentEmpty(html) && !window.confirm("Replace the current trade note with this template?")) {
      return;
    }
    const next = renderTemplateHtml(template);
    setTemplateId(template.id);
    setHtml(next);
    setRevision((n) => n + 1);
    void persist(next);
  }

  return (
    <div className="flex min-h-[280px] flex-1 flex-col">
      <div className="mb-2 flex justify-end">
        <NoteTemplateSelector currentId={templateId} onSelect={applyTemplate} />
      </div>
      <div className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-xl border border-[#E2E2E7]">
        <RichNoteEditor
          html={html}
          revision={revision}
          onChange={scheduleSave}
          fullscreen={false}
          onToggleFullscreen={() => undefined}
        />
      </div>
      {update.isPending ? (
        <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">Saving…</p>
      ) : null}
    </div>
  );
}

function DailyJournalPane({ accountId, date }: { accountId: string; date: string }) {
  const toast = useToast();
  const { data: note, isLoading, isError, refetch } = useDayNote(accountId, date);
  const upsert = useUpsertDayNote();
  const [html, setHtml] = useState("");
  const [revision, setRevision] = useState(0);
  const [templateId, setTemplateId] = useState("day-journal");
  const baseline = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef<string | null>(null);

  useEffect(() => {
    const key = `${accountId}:${date}:${note?.id ?? "none"}`;
    if (loaded.current === key) return;
    loaded.current = key;
    const next = note?.content ?? "";
    setHtml(next);
    baseline.current = next;
    setTemplateId(note?.template_id ?? "day-journal");
    setRevision((n) => n + 1);
  }, [accountId, date, note]);

  async function persist(next: string, nextTemplate = templateId) {
    if (next === baseline.current && note) return;
    try {
      const saved = await upsert.mutateAsync({
        account_id: accountId,
        date,
        content: next,
        template_id: nextTemplate,
      });
      baseline.current = saved.content;
    } catch (err) {
      toast.error("Couldn’t save journal", err instanceof Error ? err.message : undefined);
    }
  }

  function scheduleSave(next: string) {
    setHtml(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(next);
    }, 700);
  }

  function applyTemplate(template: NoteTemplate) {
    if (!isNoteContentEmpty(html) && !window.confirm("Replace the current daily journal with this template?")) {
      return;
    }
    const next = renderTemplateHtml(template);
    setTemplateId(template.id);
    setHtml(next);
    setRevision((n) => n + 1);
    void persist(next, template.id);
  }

  if (isLoading) return <Skeleton className="h-40 rounded-md" />;
  if (isError) {
    return (
      <p className="text-[13px] text-[var(--color-text-secondary)]">
        Couldn’t load the daily journal.{" "}
        <button type="button" onClick={() => refetch()} className="font-medium text-primary hover:underline">
          Try again
        </button>
      </p>
    );
  }

  if (!note && isNoteContentEmpty(html)) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          No daily journal for {date}.
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <NoteTemplateSelector currentId={templateId} onSelect={applyTemplate} />
          <Link
            href={`/notebook?tab=daily&date=${date}`}
            className="text-[12px] font-medium text-primary hover:underline"
          >
            Open in Notebook
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[280px] flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <Link
          href={`/notebook?tab=daily&date=${date}`}
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Open in Notebook
        </Link>
        <NoteTemplateSelector currentId={templateId} onSelect={applyTemplate} />
      </div>
      <div className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-xl border border-[#E2E2E7]">
        <RichNoteEditor
          html={html}
          revision={revision}
          onChange={scheduleSave}
          fullscreen={false}
          onToggleFullscreen={() => undefined}
        />
      </div>
    </div>
  );
}
