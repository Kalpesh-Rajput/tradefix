"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { useMasters } from "@/lib/hooks/useMasters";
import { useUpdateTrade } from "@/lib/hooks/useTrades";
import { assignedStrategy } from "@/lib/trades/previewStats";
import { resolveStrategyCatalog } from "@/lib/tradingDefaults";
import type { Trade } from "@/lib/types";

export function StrategyTab({ trade }: { trade: Trade }) {
  const { user } = useAuth();
  const toast = useToast();
  const update = useUpdateTrade();
  const { data: masters = [] } = useMasters("strategy");
  const catalog = useMemo(() => {
    const fromUser = resolveStrategyCatalog(user);
    const fromMasters = masters.map((m) => m.name);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...fromUser, ...fromMasters]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }, [user, masters]);

  const current = assignedStrategy(trade);
  const masterByName = useMemo(() => {
    const map = new Map(masters.map((m) => [m.name.toLowerCase(), m]));
    return map;
  }, [masters]);

  async function assign(name: string) {
    const master = masterByName.get(name.toLowerCase());
    const tags = [name, ...(trade.setup_tags ?? []).filter((t) => t.toLowerCase() !== name.toLowerCase())];
    try {
      await update.mutateAsync({
        id: trade.id,
        data: {
          strategy_name: name,
          strategy_id: master?.id ?? null,
          setup_tag: name,
          setup_tags: tags,
        },
      });
      toast.success("Strategy assigned");
    } catch (err) {
      toast.error("Couldn’t assign strategy", err instanceof Error ? err.message : undefined);
    }
  }

  async function clear() {
    const nextTags = (trade.setup_tags ?? []).filter(
      (t) => t.toLowerCase() !== (current ?? "").toLowerCase()
    );
    try {
      await update.mutateAsync({
        id: trade.id,
        data: {
          strategy_name: null,
          strategy_id: null,
          setup_tag: nextTags[0] ?? null,
          setup_tags: nextTags,
        },
      });
    } catch (err) {
      toast.error("Couldn’t remove strategy", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div>
      <label className="sr-only" htmlFor="preview-strategy">
        Pick from your Strategy library
      </label>
      <div className="relative">
        <Plus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <select
          id="preview-strategy"
          value={current ?? ""}
          disabled={update.isPending}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) void clear();
            else void assign(v);
          }}
          className="h-10 w-full appearance-none rounded-md border border-[#E2E2E7] bg-[#F7F7F9] pl-9 pr-28 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-primary/40"
        >
          <option value="">Pick from your Strategy library…</option>
          {catalog.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--color-text-tertiary)]">
          {catalog.length} available
        </span>
      </div>

      {current ? (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-primary-very-light)] px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
            Assigned strategy
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[var(--color-text-primary)]">{current}</p>
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center px-4 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F1F8] text-primary">
            <Plus className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <p className="max-w-[220px] text-[13px] text-[var(--color-text-secondary)]">
            Add a Strategy to your trade and track what works
          </p>
        </div>
      )}
    </div>
  );
}
