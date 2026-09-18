"use client";

import clsx from "clsx";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function PlaybookRowMenu({
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onOpen: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const menuId = useId();
  const router = useRouter();
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

  const items = [
    { label: "Open", run: () => router.push(onOpen) },
    { label: "Edit", run: onEdit },
    { label: "Duplicate", run: onDuplicate },
    { label: "Delete", run: onDelete, danger: true },
  ];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Playbook actions"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setPos({
            top: rect.bottom + 6,
            left: Math.max(8, Math.min(rect.right - 148, window.innerWidth - 156)),
          });
          setOpen(true);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-secondary)]"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              className="fixed z-[220] min-w-[148px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-dropdown)]"
              style={{ top: pos.top, left: pos.left }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  className={clsx(
                    "flex h-8 w-full items-center px-3 text-[12px] outline-none hover:bg-[var(--color-surface-secondary)]",
                    item.danger ? "text-[#D64545]" : "text-[var(--color-text-secondary)]"
                  )}
                  onClick={() => {
                    item.run();
                    close();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
