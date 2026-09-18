"use client";

import clsx from "clsx";
import { Copy, MoreVertical, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ChartOverflowMenu({
  canRemove,
  onDuplicate,
  onRemove,
  duplicateLabel = "Duplicate",
}: {
  canRemove: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  duplicateLabel?: string;
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            className="fixed z-[220] min-w-[148px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              role="menuitem"
              className="flex h-8 w-full items-center gap-2 px-3 text-[12px] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-secondary)]"
              onClick={() => {
                onDuplicate();
                close();
              }}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {duplicateLabel}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canRemove}
              className={clsx(
                "flex h-8 w-full items-center gap-2 px-3 text-[12px] outline-none",
                canRemove
                  ? "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                  : "cursor-not-allowed text-[var(--color-text-muted)]"
              )}
              onClick={() => {
                if (!canRemove) return;
                onRemove();
                close();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove chart
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Chart actions"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const width = 148;
          setPos({
            top: rect.bottom + 6,
            left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
          });
          setOpen(true);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] outline-none hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {panel}
    </>
  );
}
