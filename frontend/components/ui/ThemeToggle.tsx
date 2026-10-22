"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { ThemeChoices } from "@/components/ui/ThemeChoices";
import { Tooltip } from "@/components/ui/Tooltip";
import { MOTION } from "@/lib/motion";

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, themeLabel } = useAppearance();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const dark = mode === "dark";
  const label = themeLabel;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
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
      <Tooltip content={`Theme: ${label}`} side="bottom">
        <button
          ref={buttonRef}
          type="button"
          className={
            className ??
            clsx(
              "relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border bg-surface text-foreground/80 transition-[background-color,border-color,color,transform] duration-150 hover:bg-surface-2 hover:text-foreground active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100",
              open ? "border-primary/40 text-foreground" : "border-border"
            )
          }
          aria-label={`Theme: ${label}. Change theme`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((value) => !value)}
          data-testid="theme-toggle"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={dark ? "moon" : "sun"}
              initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex"
              aria-hidden
            >
              {dark ? <Moon className="h-4 w-4" strokeWidth={1.75} /> : <Sun className="h-4 w-4" strokeWidth={1.75} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </Tooltip>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="dialog"
            aria-label="Choose a theme"
            {...MOTION.dropdown}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 z-dropdown mt-2 max-h-[min(32rem,calc(100vh-5rem))] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-[var(--color-surface-elevated,var(--color-surface))] p-2 shadow-dropdown"
          >
            <ThemeChoices layout="menu" onPicked={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
