"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { MOTION, reducedPreset } from "@/lib/motion";

type Side = "top" | "bottom" | "left" | "right";

const GAP = 8;
const EDGE = 8;

/**
 * Short hint for icon-only or unfamiliar controls. Opens on hover after a delay
 * and immediately on keyboard focus; Escape dismisses.
 */
export function Tooltip({
  content,
  side = "top",
  delay = 350,
  children,
}: {
  content: ReactNode;
  side?: Side;
  delay?: number;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback(
    (immediate: boolean) => {
      clear();
      if (immediate) setOpen(true);
      else timer.current = window.setTimeout(() => setOpen(true), delay);
    },
    [delay]
  );
  const hide = useCallback(() => {
    clear();
    setOpen(false);
  }, []);

  useEffect(() => clear, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
    };
  }, [open, hide]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = anchorRef.current?.firstElementChild ?? anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const a = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let left = a.left + a.width / 2 - t.width / 2;
    let top = a.top - t.height - GAP;
    if (side === "bottom" || (side === "top" && top < EDGE)) top = a.bottom + GAP;
    if (side === "left") {
      left = a.left - t.width - GAP;
      top = a.top + a.height / 2 - t.height / 2;
    }
    if (side === "right") {
      left = a.right + GAP;
      top = a.top + a.height / 2 - t.height / 2;
    }
    left = Math.max(EDGE, Math.min(left, window.innerWidth - t.width - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - t.height - EDGE));
    setPos({ left, top });
  }, [open, side, content]);

  const child = isValidElement(children)
    ? cloneElement(children, { "aria-describedby": open ? id : children.props["aria-describedby"] })
    : children;
  const preset = reducedPreset(MOTION.fade, reduce);

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onPointerEnter={(event) => event.pointerType === "mouse" && show(false)}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={(event) => {
          if ((event.target as HTMLElement).matches(":focus-visible")) show(true);
        }}
        onBlur={hide}
      >
        {child}
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={tipRef}
                id={id}
                role="tooltip"
                {...preset}
                style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
                className="pointer-events-none fixed z-tooltip max-w-[240px] rounded-md border border-[var(--color-tooltip-border)] bg-[var(--color-tooltip-bg)] px-2 py-1 text-[11px] font-medium leading-4 text-[var(--color-tooltip-text)] shadow-dropdown"
              >
                {content}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
