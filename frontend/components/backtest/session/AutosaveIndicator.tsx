import type { SavePhase } from "./useSessionPersistence";

export function AutosaveIndicator({ phase, detail }: { phase: SavePhase; detail: string | null }) {
  const label = phase === "saving" ? "Saving…" : phase === "saved" ? "Saved" : phase === "error" ? "Saving failed" : "Not saved yet";
  return (
    <p className={`text-xs ${phase === "error" ? "text-negative" : "text-muted"}`} role="status">
      {label}
      {phase === "error" && detail ? ` — ${detail}` : ""}
    </p>
  );
}
