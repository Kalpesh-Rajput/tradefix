"use client";

import clsx from "clsx";
import { BarChart3, CalendarDays, ChartLine, ChevronDown, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { ANALYTICS_REPORTS, isAnalyticsReportId, type ReportsView } from "@/lib/reports/catalog";

export type ReportsTab = ReportsView;

const TAB_BASE =
  "relative inline-flex h-full shrink-0 items-center gap-1.5 px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0";

function tabTone(active: boolean) {
  return active
    ? "text-[var(--color-text-primary)]"
    : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]";
}

function TabUnderline({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="absolute inset-x-3 bottom-0 z-[1] h-0.5 bg-primary" aria-hidden />;
}

function NewBadge() {
  return (
    <span className="inline-flex h-4 items-center rounded-[3px] bg-primary px-1 text-[8px] font-bold uppercase leading-none tracking-[0.04em] text-primary-foreground">
      New
    </span>
  );
}

export function ReportsTabs({
  tab,
  onChange,
  trailing,
}: {
  tab: ReportsTab;
  onChange: (tab: ReportsTab) => void;
  trailing?: ReactNode;
}) {
  const reportActive = isAnalyticsReportId(tab);
  const activeReport = reportActive ? ANALYTICS_REPORTS.find((r) => r.id === tab) : undefined;

  return (
    <div className="relative flex h-11 shrink-0 items-stretch justify-between gap-3">
      <nav
        className="relative z-[1] flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Reports sections"
      >
        <TabButton
          active={tab === "performance"}
          onClick={() => onChange("performance")}
          icon={<BarChart3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
        >
          Performance
          <NewBadge />
        </TabButton>
        <TabButton
          active={tab === "overview"}
          onClick={() => onChange("overview")}
          icon={<LayoutDashboard className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
        >
          Overview
        </TabButton>
        <ReportsMenu
          active={reportActive}
          selectedId={reportActive ? tab : null}
          label={activeReport ? activeReport.navLabel : "Reports"}
          onSelect={onChange}
        />
        <Link href="/calendar" className={clsx(TAB_BASE, tabTone(false))}>
          <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Calendar
        </Link>
      </nav>
      {trailing ? <div className="relative z-[1] flex shrink-0 items-center self-center">{trailing}</div> : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-px bg-[var(--color-border)]" aria-hidden />
    </div>
  );
}

function ReportsMenu({
  active,
  selectedId,
  label,
  onSelect,
}: {
  active: boolean;
  selectedId: string | null;
  label: string;
  onSelect: (id: ReportsView) => void;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number; width: number } | null>(null);
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, ANALYTICS_REPORTS.findIndex((r) => r.id === selectedId))
  );

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pad = 8;
    const width = Math.min(280, window.innerWidth - pad * 2);
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openDown = spaceBelow >= 200 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(360, Math.max(160, openDown ? spaceBelow : spaceAbove));
    const top = openDown ? rect.bottom + 4 : Math.max(pad, rect.top - 4 - maxHeight);
    const left = Math.max(pad, Math.min(rect.left, window.innerWidth - width - pad));
    setPos({ top, left, maxHeight, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    function onReposition() {
      updatePosition();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, close, updatePosition]);

  function choose(id: ReportsView) {
    onSelect(id);
    close();
    triggerRef.current?.focus();
  }

  function onTriggerKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setHighlight(Math.max(0, ANALYTICS_REPORTS.findIndex((r) => r.id === selectedId)));
        updatePosition();
        setOpen(true);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        const item = ANALYTICS_REPORTS[highlight];
        if (item) choose(item.id);
      }
    }
    if (!open) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + ANALYTICS_REPORTS.length) % ANALYTICS_REPORTS.length);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % ANALYTICS_REPORTS.length);
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(ANALYTICS_REPORTS.length - 1);
    }
  }

  const panel =
    open && pos
      ? createPortal(
          <ul
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label="Reports"
            className="fixed z-[220] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          >
            {ANALYTICS_REPORTS.map((item, i) => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={clsx(
                      "flex min-h-9 w-full items-center px-3 text-left text-[13px] outline-none",
                      selected || i === highlight
                        ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => choose(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          if (open) close();
          else {
            setHighlight(Math.max(0, ANALYTICS_REPORTS.findIndex((r) => r.id === selectedId)));
            updatePosition();
            setOpen(true);
          }
        }}
        onKeyDown={onTriggerKey}
        className={clsx(TAB_BASE, tabTone(active))}
      >
        <ChartLine className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span>{label}</span>
        {active ? <NewBadge /> : null}
        <ChevronDown
          className={clsx("h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
        <TabUnderline show={active} />
      </button>
      {panel}
    </>
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
      aria-current={active ? "page" : undefined}
      className={clsx(TAB_BASE, tabTone(active))}
    >
      {icon}
      {children}
      <TabUnderline show={active} />
    </button>
  );
}
