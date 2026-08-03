import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        sidebar: "#000000",
        surface: "#09090b",
        "surface-2": "#18181b",
        border: "rgba(255,255,255,0.06)",
        primary: {
          DEFAULT: "#00C896",
          foreground: "#000000",
        },
        accent: {
          DEFAULT: "#00C896",
          light: "#33D4AB",
          dim: "#00A87E",
          muted: "rgba(0,200,150,0.12)",
        },
        secondary: {
          DEFAULT: "#60a5fa",
          muted: "rgba(96,165,250,0.12)",
        },
        warning: "#f59e0b",
        danger: "#ef4444",
        destructive: "#ef4444",
        muted: "#71717a",
        gold: {
          DEFAULT: "#00C896",
          light: "#33D4AB",
          dark: "#00A87E",
        },
        positive: "#00C896",
        negative: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      boxShadow: {
        card: "0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.45)",
        glow: "0 0 24px rgba(0,200,150,0.3)",
        lift: "0 12px 40px rgba(0,0,0,0.55)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
