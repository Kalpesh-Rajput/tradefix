"use client";

import clsx from "clsx";
import { ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { getReportMetric, searchReportMetrics } from "@/lib/reports/metrics";
import type { ReportMetricCategory, ReportMetricDef } from "@/lib/reports/types";

type PanelPos = { top: number; left: number; width: number; maxHeight: number };

export function MetricSelector({
  metricId,
  onChange,
  accent,
}: {
  metricId: string;
  onChange: (id: string) => void;
  accent: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<PanelPos | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [highlight, setHighlight] = useState(0);

  const selected = getReportMetric(metricId);
  const groups = useMemo(() => searchReportMetrics(query), [query]);
  const searching = query.trim().length > 0;

  const visibleMetrics = useMemo(() => {
    const out: ReportMetricDef[] = [];
    for (const group of groups) {
      if (searching || expanded[group.category]) out.push(...group.metrics);
    }
    return out;
  }, [groups, expanded, searching]);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 6;
    const pad = 8;
    const width = Math.min(320, Math.max(260, window.innerWidth - pad * 2));
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openDown = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    const available = Math.max(160, openDown ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(420, available);
    let top = openDown ? rect.bottom + gap : rect.top - gap - maxHeight;
    top = Math.max(pad, top);
    const maxHeightClamped = Math.max(160, Math.min(maxHeight, window.innerHeight - top - pad));
    if (!openDown) top = Math.max(pad, rect.top - gap - maxHeightClamped);
    let left = rect.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - width - pad));
    setPos({ top, left, width, maxHeight: maxHeightClamped });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
    setPos(null);
  }, []);

  const openPanel = useCallback(() => {
    setExpanded((prev) => ({ ...prev, [selected.category]: true }));
    updatePosition();
    setOpen(true);
  }, [selected.category, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, groups]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

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

  useEffect(() => {
    setHighlight((h) => (visibleMetrics.length === 0 ? 0 : Math.min(h, visibleMetrics.length - 1)));
  }, [visibleMetrics.length]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, visibleMetrics]);

  function selectMetric(id: string) {
    onChange(id);
    close();
    triggerRef.current?.focus();
  }

  function toggleCategory(category: ReportMetricCategory) {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) close();
      else openPanel();
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(visibleMetrics.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const metric = visibleMetrics[highlight];
      if (metric) selectMetric(metric.id);
    }
  }

  const panel =
    open && mounted && pos
      ? createPortal(
          <div
            ref={panelRef}
            role="listbox"
            id={listId}
            aria-label="Report metrics"
            className="fixed z-[220] flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              animation: "reportMenuIn 120ms ease-out",
            }}
          >
            <div className="shrink-0 border-b border-[var(--color-border-subtle)] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlight(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder="Search"
                  aria-label="Search metrics"
                  className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-8 pr-2 text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-primary/40"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="report-metric-scroll min-h-0 flex-1 overflow-y-auto py-1">
              {groups.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-[var(--color-text-muted)]">No matching metrics</p>
              ) : (
                groups.map((group) => {
                  const isOpen = searching || !!expanded[group.category];
                  return (
                    <div key={group.category}>
                      <button
                        type="button"
                        className={clsx(
                          "flex h-8 w-full items-center justify-between px-3 text-[12px] font-medium outline-none hover:bg-[var(--color-surface-secondary)] focus-visible:bg-[var(--color-surface-secondary)]",
                          isOpen ? "text-primary" : "text-[var(--color-text-secondary)]"
                        )}
                        aria-expanded={isOpen}
                        onClick={() => toggleCategory(group.category)}
                      >
                        <span className="truncate">{group.category}</span>
                        <ChevronDown
                          className={clsx(
                            "h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform",
                            isOpen && "rotate-180"
                          )}
                          aria-hidden
                        />
                      </button>
                      {isOpen
                        ? group.metrics.map((metric) => {
                            const flatIndex = visibleMetrics.findIndex((m) => m.id === metric.id);
                            const isSelected = metric.id === metricId;
                            const isActive = flatIndex === highlight;
                            return (
                              <button
                                key={metric.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                data-index={flatIndex}
                                className={clsx(
                                  "flex w-full items-start px-3 py-1.5 text-left text-[12px] leading-4 text-[var(--color-text-primary)] outline-none",
                                  isActive && "bg-[var(--color-surface-secondary)]",
                                  isSelected && "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]",
                                  !isActive && !isSelected && "hover:bg-[var(--color-surface-secondary)]"
                                )}
                                onMouseEnter={() => setHighlight(flatIndex)}
                                onClick={() => selectMetric(metric.id)}
                              >
                                <span className="min-w-0 whitespace-normal break-words">{metric.label}</span>
                              </button>
                            );
                          })
                        : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Metric: ${selected.label}`}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={clsx(
          "flex h-8 max-w-[188px] items-center gap-1 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] pl-0 pr-2 text-left outline-none",
          "hover:border-[var(--color-border-light)] focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "border-primary/40 ring-2 ring-primary/20"
        )}
      >
        <span className="h-8 w-[4px] shrink-0" style={{ background: accent }} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-text-secondary)]">
          {selected.label}
        </span>
        <ChevronDown
          className={clsx("h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
