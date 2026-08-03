"use client";

import { Loader2 } from "lucide-react";

export function TradeFooter({
  saving,
  onSave,
  disabled,
}: {
  lastSaved?: Date | null;
  saving: boolean;
  onCancel?: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="shrink-0 space-y-2 border-t border-white/[0.06] bg-zinc-950 px-5 py-4">
      <button
        type="button"
        onClick={onSave}
        disabled={disabled || saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-black transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save Trade"
        )}
      </button>
    </div>
  );
}
