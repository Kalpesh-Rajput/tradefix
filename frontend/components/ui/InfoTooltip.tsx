"use client";

import clsx from "clsx";
import { Info } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

type Side = "top" | "right" | "bottom" | "left";

const GAP = 8;
const INSET = 8;

type Coords = {
  top: number;
  left: number;
  side: Side;
  arrowX: number;
  arrowY: number;
};

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function place(trigger: DOMRect, panel: DOMRect, preferred: Side): Coords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const opposite: Record<Side, Side> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const rest = (["top", "bottom", "right", "left"] as Side[]).filter(
    (side) => side !== preferred && side !== opposite[preferred]
  );
  const order = [preferred, opposite[preferred], ...rest];

  function fits(side: Side) {
    if (side === "top") return trigger.top - panel.height - GAP >= INSET;
    if (side === "bottom") return vh - trigger.bottom - panel.height - GAP >= INSET;
    if (side === "left") return trigger.left - panel.width - GAP >= INSET;
    return vw - trigger.right - panel.width - GAP >= INSET;
  }

  const side = order.find(fits) ?? preferred;
  let top = 0;
  let left = 0;
  if (side === "top") {
    top = trigger.top - panel.height - GAP;
    left = trigger.left + trigger.width / 2 - panel.width / 2;
  } else if (side === "bottom") {
    top = trigger.bottom + GAP;
    left = trigger.left + trigger.width / 2 - panel.width / 2;
  } else if (side === "left") {
    left = trigger.left - panel.width - GAP;
    top = trigger.top + trigger.height / 2 - panel.height / 2;
  } else {
    left = trigger.right + GAP;
    top = trigger.top + trigger.height / 2 - panel.height / 2;
  }

  left = Math.min(Math.max(left, INSET), Math.max(INSET, vw - panel.width - INSET));
  top = Math.min(Math.max(top, INSET), Math.max(INSET, vh - panel.height - INSET));

  const centerX = trigger.left + trigger.width / 2;
  const centerY = trigger.top + trigger.height / 2;
  return {
    top,
    left,
    side,
    arrowX: Math.min(Math.max(centerX - left, 14), Math.max(14, panel.width - 14)),
    arrowY: Math.min(Math.max(centerY - top, 14), Math.max(14, panel.height - 14)),
  };
}

const ORIGIN: Record<Side, string> = {
  top: "bottom center",
  bottom: "top center",
  left: "center right",
  right: "center left",
};

export function HoverTip({
  content,
  side = "top",
  openOnClick = false,
  className,
  children,
}: {
  content: string;
  side?: Side;
  openOnClick?: boolean;
  className?: string;
  children: ReactElement;
}) {
  const tipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);
  const hoverRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [present, setPresent] = useState(false);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [reduce, setReduce] = useState(false);

  function showFromHover() {
    hoverRef.current = true;
    setOpen(true);
  }

  function hideFromHover() {
    hoverRef.current = false;
    if (pinnedRef.current) return;
    if (triggerRef.current?.contains(document.activeElement)) return;
    setOpen(false);
  }

  function showFromFocus() {
    setOpen(true);
  }

  function hideFromFocus(event: FocusEvent<HTMLSpanElement>) {
    if (triggerRef.current?.contains(event.relatedTarget as Node)) return;
    if (pinnedRef.current || hoverRef.current) return;
    setOpen(false);
  }

  function onClick(event: MouseEvent<HTMLSpanElement>) {
    if (!openOnClick) return;
    if (pinnedRef.current) {
      pinnedRef.current = false;
      hoverRef.current = false;
      setOpen(false);
      return;
    }
    pinnedRef.current = true;
    setOpen(true);
    event.currentTarget.querySelector("button")?.focus();
  }

  useEffect(() => {
    if (!open) {
      setVisible(false);
      const delay = reducedMotion() ? 0 : 150;
      const timer = window.setTimeout(() => setPresent(false), delay);
      return () => window.clearTimeout(timer);
    }
    setReduce(reducedMotion());
    setPresent(true);
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useLayoutEffect(() => {
    if (!present) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    function update() {
      const nextTrigger = triggerRef.current;
      const nextPanel = panelRef.current;
      if (!nextTrigger || !nextPanel) return;
      setCoords(place(nextTrigger.getBoundingClientRect(), nextPanel.getBoundingClientRect(), side));
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [present, side, content]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (triggerRef.current?.contains(event.target as Node)) return;
      pinnedRef.current = false;
      hoverRef.current = false;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      pinnedRef.current = false;
      hoverRef.current = false;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const describedBy = open ? tipId : undefined;
  const trigger = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": describedBy,
        ...(openOnClick ? { "aria-expanded": open } : {}),
      } as Record<string, unknown>)
    : children;

  return (
    <>
      <span
        ref={triggerRef}
        className={clsx(className ? "min-w-0 max-w-full" : "inline-flex max-w-full", className)}
        onMouseEnter={showFromHover}
        onMouseLeave={hideFromHover}
        onFocusCapture={showFromFocus}
        onBlurCapture={hideFromFocus}
        onClick={onClick}
      >
        {trigger}
      </span>
      {present
        ? createPortal(
            <div
              ref={panelRef}
              id={tipId}
              role="tooltip"
              className={clsx(
                "pointer-events-none fixed z-[80] w-max max-w-[280px] whitespace-pre-line rounded-lg bg-[#1C1C3A] px-3 py-2 text-[12px] font-normal leading-snug shadow-[0_8px_24px_rgba(20,16,40,0.28)]",
                reduce ? "" : "transition-[opacity,transform] duration-150 ease-out",
                visible ? "opacity-100" : "opacity-0",
                !reduce && (visible ? "scale-100" : "scale-[0.96]")
              )}
              style={{
                top: coords?.top ?? -9999,
                left: coords?.left ?? 0,
                color: "#F7F7FB",
                transformOrigin: ORIGIN[coords?.side ?? side],
              }}
            >
              {content}
              <span
                aria-hidden
                className="absolute h-2 w-2 rotate-45 bg-[#1C1C3A]"
                style={arrowStyle(coords?.side ?? side, coords?.arrowX ?? 16, coords?.arrowY ?? 16)}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function arrowStyle(side: Side, arrowX: number, arrowY: number): CSSProperties {
  if (side === "top") return { left: arrowX - 4, bottom: -4 };
  if (side === "bottom") return { left: arrowX - 4, top: -4 };
  if (side === "left") return { top: arrowY - 4, right: -4 };
  return { top: arrowY - 4, left: -4 };
}

export function InfoTooltip({
  content,
  label,
}: {
  content: string;
  label: string;
}) {
  if (!content) return null;
  return (
    <HoverTip content={content} openOnClick>
      <button
        type="button"
        aria-label={`About ${label}`}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#8B8D96] outline-none transition-colors hover:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Info className="h-3 w-3" strokeWidth={1.75} aria-hidden />
      </button>
    </HoverTip>
  );
}
