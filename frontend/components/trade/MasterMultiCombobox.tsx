"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import {
  dropdownPanelClass,
  dropdownSearchClass,
  dropdownTriggerClass,
  dropdownTriggerIdleClass,
  dropdownTriggerOpenClass,
} from "@/components/trade/dropdownStyles";
import { MasterCreateRow } from "@/components/trade/MasterCreateRow";
import { FieldLabel } from "@/components/trade/ui";
import { useEnsureMaster, useMasters } from "@/lib/hooks/useMasters";
import { masterNames, selectionSummary } from "@/lib/masters";
import type { MasterCategory } from "@/lib/types";

function summaryNoun(label: string) {
  const lower = label.trim().toLowerCase();
  if (!lower || lower.startsWith("what ")) return undefined;
  return lower;
}

function emptyTitle(label: string) {
  const lower = label.trim().toLowerCase();
  if (!lower || lower.startsWith("what ")) return "No matches found";
  return `No ${lower} found`;
}

export function MasterMultiCombobox({
  category,
  value,
  onChange,
  label,
  error,
  placeholder = "Select",
  allowCreate = true,
  disabled,
}: {
  category: MasterCategory;
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  error?: string;
  placeholder?: string;
  allowCreate?: boolean;
  disabled?: boolean;
}) {
  const { data = [], isLoading } = useMasters(category);
  const { ensure, pending: creating } = useEnsureMaster(category);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => masterNames(data, value), [data, value]);
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return names;
    return names.filter((name) => name.toLowerCase().includes(q));
  }, [names, q]);
  const canCreate = allowCreate && q.length > 0 && !names.some((name) => name.toLowerCase() === q);
  const noun = summaryNoun(label);

  useEffect(() => {
    setHighlight(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, results]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const menuHeight = 340;
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
      close();
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

  function close() {
    setOpen(false);
    setQuery("");
  }

  function selected(name: string) {
    return value.some((item) => item.toLowerCase() === name.toLowerCase());
  }

  function toggle(name: string) {
    onChange(selected(name) ? value.filter((item) => item.toLowerCase() !== name.toLowerCase()) : [...value, name]);
  }

  async function createNamed(raw: string) {
    const name = await ensure(raw, { known: names });
    if (!name) return false;
    if (!selected(name)) onChange([...value, name]);
    setQuery("");
    return true;
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
      if (results[highlight]) toggle(results[highlight]);
      else if (canCreate) void createNamed(query);
    } else if (event.key === " " && query.length === 0 && results[highlight]) {
      event.preventDefault();
      toggle(results[highlight]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close();
    }
  }

  const menu =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {open && box ? (
              <motion.div
                key="master-multi-menu"
                ref={menuRef}
                role="listbox"
                aria-multiselectable="true"
                aria-label={label}
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
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
                      placeholder={isLoading ? "Loading…" : `Search ${label.toLowerCase()}...`}
                      className={dropdownSearchClass}
                      aria-label={`Search ${label}`}
                    />
                  </div>
                  {value.length > 0 && (
                    <div className="mt-2 flex items-center justify-between px-1">
                      <p className="text-[11px] font-medium tracking-wide text-[var(--color-text-tertiary)]">
                        Selected · {value.length}
                      </p>
                      <button
                        type="button"
                        onClick={() => onChange([])}
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
                <ul ref={listRef} className="max-h-[240px] overflow-y-auto overscroll-contain px-1.5 py-1.5">
                  {results.map((name, index) => {
                    const on = selected(name);
                    const active = index === highlight;
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={on}
                          data-active={active ? "true" : "false"}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => toggle(name)}
                          className={clsx(
                            "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                            on
                              ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                              : "text-[var(--color-text-primary)]",
                            active && !on && "bg-[var(--color-surface-secondary)]",
                            !on && "hover:bg-[var(--color-surface-secondary)]"
                          )}
                        >
                          <span
                            className={clsx(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150",
                              on
                                ? "border-primary bg-primary text-on-accent"
                                : "border-[var(--color-border)] bg-[var(--color-surface)]"
                            )}
                          >
                            <Check
                              className={clsx(
                                "h-3 w-3 transition-transform duration-150",
                                on ? "scale-100" : "scale-0"
                              )}
                            />
                          </span>
                          <span className="truncate">{name}</span>
                        </button>
                      </li>
                    );
                  })}
                  {results.length === 0 && (
                    <li className="px-3 py-6 text-center">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{emptyTitle(label)}</p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">Try a different search.</p>
                    </li>
                  )}
                </ul>
                {allowCreate && (
                  <MasterCreateRow
                    label={label}
                    query={query}
                    canCreateFromQuery={canCreate}
                    pending={creating}
                    onCreate={createNamed}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>,
          document.body
        )
      : null;

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
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
        className={clsx(
          dropdownTriggerClass,
          error ? "border-destructive/50" : open ? dropdownTriggerOpenClass : dropdownTriggerIdleClass
        )}
      >
        <span className={clsx("truncate", value.length ? "font-medium text-[var(--color-text-primary)]" : "font-normal text-[var(--color-text-muted)]")}>
          {selectionSummary(value, placeholder, noun)}
        </span>
        <ChevronDown
          className={clsx(
            "h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {menu}
    </div>
  );
}
