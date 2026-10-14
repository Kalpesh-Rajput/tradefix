"use client";

export function AlignmentBanner({
  points,
  aligned,
  dismissed,
  onToggle,
  onDismiss,
}: {
  points: number;
  aligned: boolean;
  dismissed: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}) {
  if (dismissed) return null;
  const amount = Math.abs(points).toFixed(1);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary,var(--color-surface))] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
      <p className="min-w-0 flex-1">Prices come from reference market data and differ slightly from your broker (about {amount} pips).</p>
      <button
        type="button"
        aria-pressed={aligned}
        onClick={onToggle}
        className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-hex)]"
      >
        {aligned ? "Aligned to my fills" : "Align to my fills"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss price alignment notice"
        className="px-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        Dismiss
      </button>
    </div>
  );
}
