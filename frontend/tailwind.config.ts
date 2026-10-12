import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          muted: "hsl(var(--sidebar-muted) / <alpha-value>)",
          border: "hsl(var(--sidebar-border))",
          active: "var(--color-sidebar-active)",
          hover: "var(--color-sidebar-hover)",
          icon: "var(--color-text-muted)",
          divider: "var(--color-border-subtle)",
        },
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-2": "hsl(var(--surface-2) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        border: "hsl(var(--border))",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          hover: "var(--color-primary-hover)",
          light: "var(--color-primary-light)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          light: "hsl(var(--primary) / 0.85)",
          dim: "hsl(var(--primary) / 0.75)",
          muted: "hsl(var(--primary) / 0.12)",
        },
        secondary: {
          DEFAULT: "var(--color-text-secondary)",
          muted: "var(--color-surface-muted)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          bg: "var(--color-warning-bg)",
        },
        danger: {
          DEFAULT: "hsl(var(--negative) / <alpha-value>)",
          soft: "hsl(var(--negative-soft) / <alpha-value>)",
        },
        destructive: "hsl(var(--destructive) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        gold: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          light: "hsl(var(--primary) / 0.85)",
          dark: "hsl(var(--primary) / 0.75)",
        },
        positive: {
          DEFAULT: "hsl(var(--positive) / <alpha-value>)",
          soft: "hsl(var(--positive-soft) / <alpha-value>)",
        },
        negative: {
          DEFAULT: "hsl(var(--negative) / <alpha-value>)",
          soft: "hsl(var(--negative-soft) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
      },
      boxShadow: {
        card: "var(--shadow-sm)",
        "card-md": "var(--shadow-md)",
        dropdown: "var(--shadow-dropdown)",
        glow: "0 0 24px hsl(var(--primary) / 0.2)",
        lift: "0 4px 12px rgba(20, 20, 30, 0.06)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        serif: ["var(--font-brand)", "Playfair Display", "Georgia", "serif"],
        brand: ["var(--font-brand)", "Playfair Display", "Georgia", "serif"],
        display: ["var(--font-brand)", "Playfair Display", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "12px",
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
      transitionDuration: {
        DEFAULT: "160ms",
      },
    },
  },
  plugins: [],
};

export default config;
