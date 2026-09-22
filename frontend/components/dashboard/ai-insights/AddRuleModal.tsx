"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useAppendManualRule } from "@/lib/hooks/useAiInsights";

export function AddRuleModal({ ruleName, onClose }: { ruleName: string; onClose: () => void }) {
  const toast = useToast();
  const append = useAppendManualRule();
  const [name, setName] = useState(ruleName);

  async function confirm() {
    const cleaned = name.trim();
    if (!cleaned) {
      toast.error("Rule name is required");
      return;
    }
    try {
      await append.mutateAsync({ name: cleaned });
      toast.success("Rule added", "It is now on your Progress Tracker. Nothing was enabled automatically.");
      onClose();
    } catch {
      toast.error("Couldn’t add that rule");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="dash-card w-full max-w-md p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-rule-title"
      >
        <h3 id="add-rule-title" className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Add as a Progress Tracker rule?
        </h3>
        <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
          TradeFix will not change your rules unless you confirm. This creates a checklist rule you can track
          yourself.
        </p>
        <label className="mt-3 block text-[11px] font-medium text-[var(--color-text-tertiary)]">
          Rule name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-primary/40"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void confirm()} disabled={append.isPending}>
            {append.isPending ? "Adding…" : "Add rule"}
          </Button>
        </div>
      </div>
    </div>
  );
}
