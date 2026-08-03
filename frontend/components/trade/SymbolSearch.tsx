"use client";

import { Check, Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Control, Controller } from "react-hook-form";

import { AddTradeFormValues, POPULAR_SYMBOLS } from "@/components/trade/schema";
import { FieldLabel } from "@/components/trade/ui";

const FAVORITES_KEY = "tradefix_symbol_favorites";
const RECENT_KEY = "tradefix_symbol_recent";

function loadList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveList(key: string, list: string[]) {
  localStorage.setItem(key, JSON.stringify(list.slice(0, 12)));
}

export function SymbolSearch({
  control,
  error,
}: {
  control: Control<AddTradeFormValues>;
  error?: string;
}) {
  return (
    <Controller
      control={control}
      name="symbol"
      render={({ field }) => (
        <SymbolSearchInner value={field.value} onChange={field.onChange} error={error} />
      )}
    />
  );
}

function SymbolSearchInner({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFavorites(loadList(FAVORITES_KEY));
    setRecent(loadList(RECENT_KEY));
  }, []);

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

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    const pool = Array.from(new Set([...recent, ...favorites, ...POPULAR_SYMBOLS]));
    if (!q) return pool.slice(0, 10);
    return pool.filter((s) => s.includes(q)).slice(0, 10);
  }, [query, recent, favorites]);

  function select(symbol: string) {
    const s = symbol.toUpperCase();
    onChange(s);
    setQuery(s);
    setOpen(false);
    const nextRecent = [s, ...recent.filter((x) => x !== s)];
    setRecent(nextRecent);
    saveList(RECENT_KEY, nextRecent);
  }

  function toggleFavorite(symbol: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = favorites.includes(symbol)
      ? favorites.filter((f) => f !== symbol)
      : [symbol, ...favorites];
    setFavorites(next);
    saveList(FAVORITES_KEY, next);
  }

  return (
    <div ref={rootRef} className="relative">
      <FieldLabel error={error}>Symbol</FieldLabel>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-zinc-900 px-3 transition focus-within:border-primary/40 ${
          error ? "border-destructive/50" : "border-white/10"
        }`}
      >
        <Search className="h-4 w-4 text-zinc-500" />
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const v = e.target.value.toUpperCase();
            setQuery(v);
            onChange(v);
            setOpen(true);
          }}
          placeholder="Search symbol (e.g. AAPL)"
          className="w-full bg-transparent py-2 font-mono text-sm uppercase text-white outline-none placeholder:text-zinc-600"
          aria-label="Search symbol"
          autoComplete="off"
        />
        {value && <Check className="h-4 w-4 text-primary" />}
      </div>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-lift">
          {recent.length > 0 && !query && (
            <div className="border-b border-white/[0.06] px-3 py-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => select(s)}
                    className="rounded-lg bg-white/[0.04] px-2 py-1 text-xs text-white hover:bg-accent-muted hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-3 py-3 text-xs text-muted">No matches — press Enter to use “{query}”</li>
            )}
            {results.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => select(s)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white hover:bg-white/[0.04]"
                >
                  <span className="font-medium">{s}</span>
                  <button
                    type="button"
                    aria-label={`Favorite ${s}`}
                    onClick={(e) => toggleFavorite(s, e)}
                    className="rounded p-1 text-muted hover:text-warning"
                  >
                    <Star className={`h-3.5 w-3.5 ${favorites.includes(s) ? "fill-warning text-warning" : ""}`} />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
