"use client";

import clsx from "clsx";
import { Check, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FieldLabel } from "@/components/trade/ui";
import { useCreateMaster, useMasters } from "@/lib/hooks/useMasters";
import type { MasterCategory } from "@/lib/types";

export function MasterCombobox({
  category,
  value,
  onChange,
  label,
  error,
  placeholder,
  allowCreate = true,
  uppercase = false,
  disabled,
}: {
  category: MasterCategory;
  value: string;
  onChange: (next: string) => void;
  label: string;
  error?: string;
  placeholder?: string;
  allowCreate?: boolean;
  uppercase?: boolean;
  disabled?: boolean;
}) {
  const { data = [], isLoading } = useMasters(category);
  const createMaster = useCreateMaster();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const names = useMemo(() => data.map((m) => m.name), [data]);
  const q = query.trim();
  const qCmp = uppercase ? q.toUpperCase() : q;
  const results = useMemo(() => {
    if (!q) return names.slice(0, 12);
    const needle = q.toLowerCase();
    return names.filter((n) => n.toLowerCase().includes(needle)).slice(0, 12);
  }, [names, q]);

  const canCreate =
    allowCreate &&
    q.length > 0 &&
    !names.some((n) => n.toLowerCase() === q.toLowerCase());

  function select(name: string) {
    const next = uppercase ? name.toUpperCase() : name;
    onChange(next);
    setQuery(next);
    setOpen(false);
  }

  async function createCustom() {
    const name = uppercase ? qCmp : q;
    if (!name) return;
    try {
      const row = await createMaster.mutateAsync({ category, name });
      select(row.name);
    } catch {
      select(name);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <FieldLabel error={error}>{label}</FieldLabel>
      <div
        className={clsx(
          "flex items-center gap-2 rounded-lg border bg-zinc-900 px-3 transition focus-within:border-primary/40",
          error ? "border-destructive/50" : "border-white/10",
          disabled && "opacity-40"
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <input
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const next = uppercase ? e.target.value.toUpperCase() : e.target.value;
            setQuery(next);
            onChange(next);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) select(results[0]);
              else if (canCreate) void createCustom();
            }
          }}
          placeholder={placeholder || (isLoading ? "Loading…" : "Search or add")}
          className="w-full bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          autoComplete="off"
        />
        {value && <Check className="h-3.5 w-3.5 text-primary" />}
      </div>
      {open && !disabled && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-lift">
          <ul className="max-h-52 overflow-y-auto py-1">
            {results.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => select(name)}
                  className={clsx(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/[0.04]",
                    name === value ? "text-primary" : "text-white"
                  )}
                >
                  {name}
                  {name === value && <Check className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
            {results.length === 0 && !canCreate && (
              <li className="px-3 py-3 text-xs text-muted">No matches</li>
            )}
          </ul>
          {canCreate && (
            <button
              type="button"
              onClick={() => void createCustom()}
              disabled={createMaster.isPending}
              className="flex w-full items-center gap-2 border-t border-white/[0.06] px-3 py-2.5 text-left text-xs text-primary hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Add “{qCmp}” for next time
            </button>
          )}
        </div>
      )}
    </div>
  );
}
