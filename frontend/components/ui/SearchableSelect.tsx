"use client";

import clsx from "clsx";
import { Check, ChevronDown, Search } from "lucide-react";
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

type Option = { value: string; label: string };

type SearchableSelectProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  searchPlaceholder?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "aria-label"?: string;
};

type PanelPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

/**
 * Custom combobox rendered via portal so it isn't clipped by overflow containers.
 * Panel opens below the trigger with a fixed max height and internal scroll.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  onBlur,
  searchPlaceholder = "Search…",
  placeholder = "Select…",
  disabled,
  id,
  name,
  className,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<PanelPos | null>(null);

  useEffect(() => setMounted(true), []);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    // Prefer opening downward; only flip up if below has almost no room
    const openDown = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(280, Math.max(140, openDown ? spaceBelow : spaceAbove));
    const top = openDown ? rect.bottom + gap : rect.top - gap - maxHeight;
    setPos({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
    setPos(null);
    onBlur?.();
  }, [onBlur]);

  const openPanel = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [disabled, options, updatePosition, value]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
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
    setHighlight((h) => (filtered.length === 0 ? 0 : Math.min(h, filtered.length - 1)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, filtered]);

  function selectOption(opt: Option) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    setHighlight(0);
    setPos(null);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPanel();
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  }

  const panel =
    open && mounted && pos
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[200] flex flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-xl shadow-black/60"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
            }}
          >
            <div className="shrink-0 border-b border-white/[0.06] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setHighlight(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-white/10 bg-black py-2 pl-8 pr-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-primary/40"
                  aria-autocomplete="list"
                  aria-controls={listId}
                  autoComplete="off"
                />
              </div>
            </div>

            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-zinc-500">No matches</li>
              ) : (
                filtered.map((opt, index) => {
                  const isSelected = opt.value === value;
                  const isActive = index === highlight;
                  return (
                    <li
                      key={opt.value}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      className={clsx(
                        "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors",
                        isActive && "bg-white/[0.06]",
                        isSelected ? "text-primary" : "text-zinc-200",
                        !isActive && "hover:bg-white/[0.04]"
                      )}
                      onMouseEnter={() => setHighlight(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectOption(opt);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      )}
                    </li>
                  );
                })
              )}
            </ul>

            <div className="shrink-0 border-t border-white/[0.06] px-3 py-1.5 text-[10px] text-zinc-600">
              {filtered.length === options.length
                ? `${options.length} options`
                : `${filtered.length} of ${options.length}`}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} readOnly /> : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-black px-3 py-2.5 text-left text-sm outline-none transition",
          "focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/30",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-white/20",
          open && "border-primary/40"
        )}
      >
        <span className={clsx("min-w-0 truncate", selected ? "text-white" : "text-zinc-600")}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={clsx("h-4 w-4 shrink-0 text-zinc-500 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {panel}
    </div>
  );
}
