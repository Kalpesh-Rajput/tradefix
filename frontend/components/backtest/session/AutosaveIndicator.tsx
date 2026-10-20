import type { SavePhase } from "./useSessionPersistence";

export function AutosaveIndicator({ phase, detail }: { phase: SavePhase; detail: string | null }) {
  const label = phase === "saving" ? "Saving" : phase === "saved" ? "Saved" : phase === "error" ? "Not saved" : "Not saved yet";
  const dot =
    phase === "saved"
      ? "bg-[var(--color-success-text)]"
      : phase === "saving"
        ? "bg-primary motion-safe:animate-pulse"
        : phase === "error"
          ? "bg-[var(--color-danger-text)]"
          : "bg-muted";

  return (
    <p className={`inline-flex items-center gap-1.5 text-xs ${phase === "error" ? "text-negative" : "text-muted"}`} role="status">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span>{label}</span>
      {phase === "error" && detail ? <span className="max-w-[12rem] truncate">— {detail}</span> : null}
    </p>
  );
}
