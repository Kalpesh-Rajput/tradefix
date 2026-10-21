export function pnlClass(amount: number): string {
  if (amount > 0) return "text-[var(--color-success-text)]";
  if (amount < 0) return "text-[var(--color-danger-text)]";
  return "text-foreground";
}
