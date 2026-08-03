import clsx from "clsx";

type BadgeTone = "gold" | "positive" | "negative" | "neutral" | "warning";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "gold" && "bg-gold/15 text-gold",
        tone === "positive" && "bg-positive/15 text-positive",
        tone === "negative" && "bg-negative/15 text-negative",
        tone === "warning" && "bg-amber-500/15 text-amber-400",
        tone === "neutral" && "bg-surface-2 text-gray-300"
      )}
    >
      {children}
    </span>
  );
}
