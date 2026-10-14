export type ChartTheme = {
  mode: "light" | "dark";
  background: string;
  text: string;
  grid: string;
  border: string;
  crosshair: string;
  crosshairLabel: string;
  up: string;
  down: string;
  accent: string;
  fontFamily: string;
};

const LIGHT_FALLBACK: ChartTheme = {
  mode: "light",
  background: "#ffffff",
  text: "#85868e",
  grid: "#ecedef",
  border: "#e8e8ec",
  crosshair: "#85868e",
  crosshairLabel: "#4a4b52",
  up: "#40c79a",
  down: "#f26969",
  accent: "#4f46e5",
  fontFamily: "Inter, system-ui, sans-serif",
};

const DARK_FALLBACK: ChartTheme = {
  ...LIGHT_FALLBACK,
  mode: "dark",
  background: "#121318",
  text: "#9a9ba3",
  grid: "#22232a",
  border: "#2a2b33",
  crosshair: "#6b6c74",
  crosshairLabel: "#2a2b33",
};

const TOKENS: Record<Exclude<keyof ChartTheme, "mode" | "fontFamily">, string[]> = {
  background: ["--color-surface"],
  text: ["--color-chart-axis", "--color-text-muted"],
  grid: ["--color-chart-grid", "--color-border-subtle"],
  border: ["--color-border"],
  crosshair: ["--color-text-muted"],
  crosshairLabel: ["--color-text-secondary"],
  up: ["--color-chart-profit", "--color-success-text"],
  down: ["--color-chart-loss", "--color-danger-text"],
  accent: ["--accent-hex", "--color-chart-line"],
};

function readToken(styles: CSSStyleDeclaration, names: string[]): string | null {
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim();
    if (value && !value.startsWith("var(")) return value;
  }
  return null;
}

export function readChartTheme(root?: HTMLElement): ChartTheme {
  if (typeof document === "undefined") return LIGHT_FALLBACK;
  const element = root ?? document.documentElement;
  const mode = element.classList.contains("dark") ? "dark" : "light";
  const fallback = mode === "dark" ? DARK_FALLBACK : LIGHT_FALLBACK;
  const styles = getComputedStyle(element);
  const theme = { ...fallback, mode } as ChartTheme;
  for (const [key, names] of Object.entries(TOKENS) as [keyof typeof TOKENS, string[]][]) {
    theme[key] = readToken(styles, names) ?? fallback[key];
  }
  const font = document.body ? getComputedStyle(document.body).fontFamily : "";
  theme.fontFamily = font || fallback.fontFamily;
  return theme;
}

export function subscribeThemeChanges(onChange: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-preference", "data-custom-theme"],
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return color;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const value = Number.parseInt(full, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
