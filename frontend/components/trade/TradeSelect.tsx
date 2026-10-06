"use client";

import clsx from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import {
  dropdownPanelClass,
  dropdownSearchClass,
  dropdownTriggerClass,
  dropdownTriggerIdleClass,
  dropdownTriggerOpenClass,
} from "@/components/trade/dropdownStyles";
import { FieldLabel } from "@/components/trade/ui";

export function TradeSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  error,
  disabled,
  clearable = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, q]);

  useEffect(() => {
    setHighlight(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const menuHeight = 280;
      const below = window.innerHeight - rect.bottom;
      const top = below < menuHeight && rect.top > below ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6;
      setBox({ top, left, width });
    }
    place();
    searchRef.current?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[highlight]) choose(results[highlight].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  }

  const menu =
    open && box
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={label}
            style={{ top: box.top, left: box.left, width: box.width }}
            className={dropdownPanelClass}
          >
            <div className="border-b border-[var(--color-border)] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder={`Search ${label.toLowerCase()}...`}
                  className={dropdownSearchClass}
                  aria-label={`Search ${label}`}
                />
              </div>
            </div>
            <ul className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5 py-1.5">
              {results.map((option, index) => {
                const on = option.value === value;
                return (
                  <li key={option.value || "none"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(option.value)}
                      className={clsx(
                        "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors duration-100",
                        on
                          ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]",
                        index === highlight && !on && "bg-[var(--color-surface-secondary)]"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150",
                          on ? "border-primary bg-primary text-on-accent" : "border-[var(--color-border)] bg-[var(--color-surface)]"
                        )}
                      >
                        <Check className={clsx("h-3 w-3 transition-transform duration-150", on ? "scale-100" : "scale-0")} />
                      </span>
                      <span className="truncate">{option.label}</span>
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && <li className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No matches</li>}
            </ul>
          </div>,
          document.body
        )
      : null;

  const shown = selected?.label || placeholder;

  return (
    <div ref={rootRef} className="relative">
      <FieldLabel error={error}>{label}</FieldLabel>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={clsx(
          dropdownTriggerClass,
          error ? "border-destructive/50" : open ? dropdownTriggerOpenClass : dropdownTriggerIdleClass
        )}
      >
        <span className={clsx("truncate", selected ? "font-medium text-[var(--color-text-primary)]" : "font-normal text-[var(--color-text-muted)]")}>
          {shown}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[var(--color-text-muted)]">
          {clearable && value && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange("");
                }
              }}
              className="rounded p-0.5 hover:text-[var(--color-text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={clsx("h-4 w-4 transition-transform duration-150", open && "rotate-180")} />
        </span>
      </button>
      {menu}
    </div>
  );
}
