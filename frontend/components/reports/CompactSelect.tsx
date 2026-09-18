"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type CompactOption<T extends string> = { id: T; label: string };

export function CompactSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  uppercase = false,
  width = 148,
}: {
  value: T;
  options: CompactOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  uppercase?: boolean;
  width?: number;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [highlight, setHighlight] = useState(() => Math.max(0, options.findIndex((o) => o.id === value)));
  const selected = options.find((o) => o.id === value) ?? options[0];

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pad = 8;
    const left = Math.max(pad, Math.min(rect.left, window.innerWidth - width - pad));
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openDown = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(280, Math.max(120, openDown ? spaceBelow : spaceAbove));
    const top = openDown ? rect.bottom + 6 : Math.max(pad, rect.top - 6 - maxHeight);
    setPos({ top, left, maxHeight });
  }, [width]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    function onReposition() {
      updatePosition();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, close, updatePosition]);

  function move(delta: number) {
    if (!options.length) return;
    setHighlight((h) => (h + delta + options.length) % options.length);
  }

  function choose(id: T) {
    onChange(id);
    close();
    triggerRef.current?.focus();
  }

  function onTriggerKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setHighlight(Math.max(0, options.findIndex((o) => o.id === value)));
        updatePosition();
        setOpen(true);
        return;
      }
      if (e.key === "ArrowDown") {
        move(1);
        return;
      }
      if (e.key === "ArrowUp") {
        move(-1);
        return;
      }
      choose(options[highlight]?.id ?? value);
    }
    if (!open) return;
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  }

  const panel =
    open && pos
      ? createPortal(
          <ul
            ref={panelRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-[220] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: pos.top, left: pos.left, width, maxHeight: pos.maxHeight }}
          >
            {options.map((opt, i) => {
              const isSelected = opt.id === value;
              return (
                <li key={opt.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={clsx(
                      "flex h-8 w-full items-center px-3 text-[12px] font-medium outline-none",
                      uppercase && "uppercase tracking-wide",
                      i === highlight || isSelected
                        ? "bg-[var(--color-primary-very-light)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                    )}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => choose(opt.id)}
                  >
                    {opt.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${ariaLabel}: ${selected?.label ?? ""}`}
        onClick={() => {
          if (open) close();
          else {
            setHighlight(Math.max(0, options.findIndex((o) => o.id === value)));
            updatePosition();
            setOpen(true);
          }
        }}
        onKeyDown={onTriggerKey}
        className={clsx(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-primary)] outline-none",
          uppercase && "uppercase tracking-wide",
          "hover:bg-[var(--color-primary-very-light)] focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "border-primary/40 ring-2 ring-primary/20"
        )}
      >
        {selected?.label}
        <ChevronDown
          className={clsx("h-3.5 w-3.5 text-[var(--color-text-muted)]", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {panel}
    </>
  );
}
