"use client";

import clsx from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { MOTION, reducedPreset } from "@/lib/motion";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: portal, scrim, focus trap, Escape to close, body scroll lock,
 * and focus restoration to the element that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  initialFocus,
  dismissible = true,
  layer = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Selector inside the panel to focus on open. Defaults to the first focusable element. */
  initialFocus?: string;
  /** When false, Escape and the scrim do not close (e.g. while saving). */
  dismissible?: boolean;
  /** `confirm` stacks above every other modal. */
  layer?: "modal" | "confirm";
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        (initialFocus ? panel.querySelector<HTMLElement>(initialFocus) : null) ??
        panel.querySelector<HTMLElement>(FOCUSABLE) ??
        panel;
      target.focus();
    });

    function onKey(event: KeyboardEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === "Escape" && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, initialFocus]);

  if (typeof document === "undefined") return null;
  const panelMotion = reducedPreset(MOTION.modal, reduce);
  const scrimMotion = reducedPreset(MOTION.fade, reduce);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={clsx(
            "fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6",
            layer === "confirm" ? "z-confirm" : "z-modal"
          )}
        >
          <motion.div
            {...scrimMotion}
            className="tf-overlay-scrim absolute inset-0"
            aria-hidden
            onClick={() => dismissible && onClose()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            {...panelMotion}
            className={clsx(
              "relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated,var(--color-surface))] text-[var(--color-text-primary)] shadow-dropdown outline-none sm:max-h-[calc(100dvh-3rem)]",
              size === "sm" && "max-w-sm",
              size === "md" && "max-w-md",
              size === "lg" && "max-w-2xl"
            )}
          >
            <div className="flex items-start gap-3 px-5 pb-2 pt-4">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
                  {title}
                </h2>
                {description ? (
                  <p id={descId} className="mt-1 text-[13px] leading-5 text-[var(--color-text-secondary)]">
                    {description}
                  </p>
                ) : null}
              </div>
              {dismissible ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="-mr-1 -mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-foreground/[0.06] hover:text-[var(--color-text-primary)]"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
            {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div> : null}
            {footer ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border-subtle,var(--color-border))] bg-[var(--color-surface)] px-5 py-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
