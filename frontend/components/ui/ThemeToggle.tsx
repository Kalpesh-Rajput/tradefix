"use client";

import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { ThemeChoices } from "@/components/ui/ThemeChoices";
import { THEME_PRESETS } from "@/lib/theme-registry";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme } = useAppearance();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const dark = THEME_PRESETS[resolvedTheme].mode === "dark";
  const label = theme === "system" ? "Follow device" : THEME_PRESETS[resolvedTheme].name;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={
          className ??
          "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-foreground/80 transition-colors duration-150 hover:bg-surface-2 hover:text-foreground motion-reduce:transition-none"
        }
        aria-label={`Theme: ${label}. Change theme`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
      {open && (
        <div
          id={menuId}
          role="dialog"
          aria-label="Choose a theme"
          className={clsx(
            "absolute right-0 z-50 mt-2 max-h-[min(32rem,calc(100vh-5rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-dropdown"
          )}
        >
          <ThemeChoices layout="menu" onPicked={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
