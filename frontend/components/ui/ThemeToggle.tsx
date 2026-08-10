"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { resolveTheme } from "@/lib/appearance";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, saving } = useAppearance();
  const [systemDark, setSystemDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isLight = resolveTheme(theme, systemDark) === "light";

  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={
        className ??
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-60"
      }
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
