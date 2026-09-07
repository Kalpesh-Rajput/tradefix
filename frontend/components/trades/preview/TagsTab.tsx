"use client";

import { MoreHorizontal, Tag } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { resolveEmotionCatalog } from "@/lib/emotions";
import { useMasters } from "@/lib/hooks/useMasters";
import { useUpdateTrade } from "@/lib/hooks/useTrades";
import { resolveMistakeCatalog } from "@/lib/tradingDefaults";
import type { Trade } from "@/lib/types";

export function TagsTab({ trade }: { trade: Trade }) {
  const { user } = useAuth();
  const toast = useToast();
  const update = useUpdateTrade();
  const { data: timeframes = [] } = useMasters("timeframe");

  const mistakes = useMemo(() => resolveMistakeCatalog(user), [user]);
  const emotions = useMemo(() => resolveEmotionCatalog(user), [user]);
  const tfOptions = useMemo(() => {
    const names = timeframes.map((m) => m.name);
    if (trade.entry_timeframe && !names.includes(trade.entry_timeframe)) {
      return [trade.entry_timeframe, ...names];
    }
    return names;
  }, [timeframes, trade.entry_timeframe]);

  async function patch(data: Parameters<typeof update.mutateAsync>[0]["data"]) {
    try {
      await update.mutateAsync({ id: trade.id, data });
    } catch (err) {
      toast.error("Couldn’t update tags", err instanceof Error ? err.message : undefined);
    }
  }

  const selectedMistake = trade.rules_broken?.[0] ?? "";
  const selectedEmotion = trade.emotion_tags?.[0] ?? "";

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Tags</h3>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">Organize this trade</p>
        </div>
        <Link
          href="/settings/trading-defaults"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Manage tags
        </Link>
      </div>

      <Category
        title="Mistakes"
        accent="#E6B325"
        value={selectedMistake}
        options={mistakes}
        disabled={update.isPending}
        onChange={(v) => patch({ rules_broken: v ? [v] : [] })}
      />
      <Category
        title="Emotions"
        accent="#3BB273"
        value={selectedEmotion}
        options={emotions}
        disabled={update.isPending}
        onChange={(v) => patch({ emotion_tags: v ? [v] : [] })}
      />
      <Category
        title="Entry TF"
        accent="#7C5CBF"
        value={trade.entry_timeframe ?? ""}
        options={tfOptions}
        disabled={update.isPending}
        onChange={(v) => patch({ entry_timeframe: v || null })}
      />

      <div className="mt-4 flex items-center justify-between">
        <Link
          href="/settings/trading-defaults"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Add new category
        </Link>
        <Link
          href="/settings/trading-defaults"
          className="text-[12px] font-medium text-primary hover:underline"
        >
          Manage tags
        </Link>
      </div>
    </div>
  );
}

function Category({
  title,
  accent,
  value,
  options,
  disabled,
  onChange,
}: {
  title: string;
  accent: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3 rounded-lg border border-[#EFEFF2] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5" style={{ color: accent }} strokeWidth={1.75} />
          <span className="text-[13px] font-medium text-[var(--color-text-primary)]">{title}</span>
        </div>
        <Link
          href="/settings/trading-defaults"
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[#F5F5F7] hover:text-[var(--color-text-primary)]"
          aria-label={`Manage ${title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Link>
      </div>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-[#E2E2E7] bg-white px-2.5 text-[13px] outline-none focus:border-primary/40 disabled:opacity-50"
      >
        <option value="">Select tag</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
