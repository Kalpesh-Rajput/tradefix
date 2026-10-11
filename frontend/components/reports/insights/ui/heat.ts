const PROFIT_RGB = "47, 158, 106";
const LOSS_RGB = "214, 69, 69";

export function heatColor(value: number, maxAbs: number): string {
  if (!value || !maxAbs) return "var(--color-surface-secondary)";
  const t = Math.min(1, Math.abs(value) / maxAbs);
  const alpha = 0.08 + Math.sqrt(t) * 0.34;
  return `rgba(${value > 0 ? PROFIT_RGB : LOSS_RGB}, ${alpha.toFixed(3)})`;
}

export function neutralHeat(value: number, max: number, rgb: string): string {
  if (!value || !max) return "var(--color-surface-secondary)";
  const t = Math.min(1, value / max);
  return `rgba(${rgb}, ${(0.08 + Math.sqrt(t) * 0.4).toFixed(3)})`;
}
