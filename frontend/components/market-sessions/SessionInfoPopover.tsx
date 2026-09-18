"use client";

import clsx from "clsx";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { formatSessionHours, formatTimeInZone, friendlyTimeZoneLabel } from "@/lib/market-sessions/timezone";
import type { HourCycle, SessionRowView } from "@/lib/market-sessions/types";

export function SessionDetails({
  row,
  viewTimeZone,
  hourCycle,
}: {
  row: SessionRowView;
  viewTimeZone: string;
  hourCycle: HourCycle;
}) {
  const localOpen = formatTimeInZone(row.open, row.def.timezone, hourCycle);
  const localClose = formatTimeInZone(row.close, row.def.timezone, hourCycle);
  const convertedOpen = formatTimeInZone(row.open, viewTimeZone, hourCycle);
  const convertedClose = formatTimeInZone(row.close, viewTimeZone, hourCycle);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
      <dt className="text-[var(--color-text-muted)]">Session</dt>
      <dd className="font-medium text-[var(--color-text-primary)]">{row.def.name}</dd>
      <dt className="text-[var(--color-text-muted)]">Timezone</dt>
      <dd className="text-[var(--color-text-primary)]">{row.def.timezone.replace(/_/g, " ")}</dd>
      <dt className="text-[var(--color-text-muted)]">Local hours</dt>
      <dd className="text-[var(--color-text-primary)]">
        {localOpen} – {localClose}
      </dd>
      <dt className="text-[var(--color-text-muted)]">Selected zone</dt>
      <dd className="min-w-0 truncate text-[var(--color-text-primary)]">
        {friendlyTimeZoneLabel(viewTimeZone, row.open)}
      </dd>
      <dt className="text-[var(--color-text-muted)]">Converted</dt>
      <dd className="text-[var(--color-text-primary)]">
        {convertedOpen} – {convertedClose}
      </dd>
      <dt className="text-[var(--color-text-muted)]">Status</dt>
      <dd className="font-medium text-[var(--color-text-primary)]">{row.isOpen ? "Open" : "Closed"}</dd>
      <dt className="text-[var(--color-text-muted)]">Duration</dt>
      <dd className="text-[var(--color-text-primary)]">{formatSessionHours(row.durationMinutes)}</dd>
    </dl>
  );
}

export function SessionInfoPopover({
  row,
  viewTimeZone,
  hourCycle,
  className,
  children,
}: {
  row: SessionRowView;
  viewTimeZone: string;
  hourCycle: HourCycle;
  className?: string;
  children: ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function cancelClose() {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 160);
  }

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 280;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 8, window.innerHeight - 240);
    setPos({ top, left });

    function onPointer(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        className={clsx(
          "text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          className
        )}
      >
        {children}
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={`${row.def.name} session details`}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
              className="fixed z-[220] w-[280px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-dropdown)]"
              style={{ top: pos.top, left: pos.left }}
            >
              <SessionDetails row={row} viewTimeZone={viewTimeZone} hourCycle={hourCycle} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
