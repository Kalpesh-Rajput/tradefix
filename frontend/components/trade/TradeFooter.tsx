"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function TradeFooter({
  saving,
  onSave,
  onCancel,
  disabled,
  message,
}: {
  lastSaved?: Date | null;
  saving: boolean;
  onCancel?: () => void;
  onSave: () => void;
  disabled?: boolean;
  message?: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3.5">
      <p className="min-w-0 flex-1 truncate text-[13px] text-destructive" role="status">
        {message || ""}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className="h-9 min-w-[7.5rem] rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground text-on-accent hover:bg-primary-hover"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving Trade...
            </>
          ) : (
            "Save Trade"
          )}
        </Button>
      </div>
    </div>
  );
}
