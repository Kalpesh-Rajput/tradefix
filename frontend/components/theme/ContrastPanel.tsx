"use client";

import { evaluateContrast, type ColorMap, type ContrastResult } from "@/lib/custom-theme";
import { tokenById } from "@/lib/custom-theme-tokens";

export function ContrastPanel({
  colors,
  onApplyFix,
}: {
  colors: ColorMap;
  onApplyFix: (tokenId: string, color: string) => void;
}) {
  const results = evaluateContrast(colors);
  const failures = results.filter((result) => !result.pass);

  return (
    <section className="rounded-lg border border-border bg-surface" aria-labelledby="contrast-heading">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h3 id="contrast-heading" className="text-[13px] font-semibold text-foreground">
          Contrast
        </h3>
        <span className={failures.length ? "text-[11px] font-medium text-destructive" : "text-[11px] font-medium text-[var(--color-success-text)]"}>
          {failures.length ? `${failures.length} below WCAG AA` : "WCAG AA checks passed"}
        </span>
      </div>
      <ul className="max-h-52 space-y-2 overflow-y-auto p-3">
        {results.map((result) => (
          <ContrastRow key={result.pair.id} result={result} onApplyFix={onApplyFix} />
        ))}
      </ul>
    </section>
  );
}

function ContrastRow({
  result,
  onApplyFix,
}: {
  result: ContrastResult;
  onApplyFix: (tokenId: string, color: string) => void;
}) {
  const ratio = result.ratio == null ? "—" : `${result.ratio.toFixed(2)}:1`;
  const token = tokenById(result.pair.foreground);
  return (
    <li className="text-[11px] leading-snug">
      <p className="font-medium text-foreground">
        {result.pair.label}
        <span className={result.pass ? "ml-2 text-[var(--color-success-text)]" : "ml-2 text-destructive"}>
          {ratio} {result.pass ? "passes" : `needs ${result.pair.minimum}:1`}
        </span>
      </p>
      {!result.pass && result.suggestion && token && (
        <button
          type="button"
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-surface-2"
          onClick={() => onApplyFix(result.pair.foreground, result.suggestion!)}
        >
          <span className="h-3 w-3 rounded-sm border border-border" style={{ background: result.suggestion }} />
          Fix contrast · {token.label} to {result.suggestion}
        </button>
      )}
    </li>
  );
}
