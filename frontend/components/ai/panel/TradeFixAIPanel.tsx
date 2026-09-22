"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useJournalAi } from "@/components/ai/panel/JournalAiContext";
import { TradeFixAIChat } from "@/components/ai/panel/TradeFixAIChat";
import { TradeFixAIHeader } from "@/components/ai/panel/TradeFixAIHeader";
import { TradeFixAIHistory } from "@/components/ai/panel/TradeFixAIHistory";
import { TradeFixAIInput } from "@/components/ai/panel/TradeFixAIInput";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobile(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return mobile;
}

export function TradeFixAIPanel() {
  const { open, fullscreen, historyOpen, close, toggleFullscreen, toggleHistory } = useJournalAi();
  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (historyOpen) {
        toggleHistory();
        return;
      }
      if (fullscreen && !mobile) {
        toggleFullscreen();
        return;
      }
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fullscreen, historyOpen, mobile, close, toggleFullscreen, toggleHistory]);

  useEffect(() => {
    if (!open || !mobile) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      panel.style.bottom = `${covered}px`;
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      if (panelRef.current) panelRef.current.style.bottom = "";
    };
  }, [open, mobile]);

  if (!mounted) return null;

  const enter = reduce
    ? { opacity: 0 }
    : mobile
      ? { opacity: 0, y: 18 }
      : { opacity: 0, x: 28 };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          id="tradefix-ai-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="tradefix-ai-title"
          tabIndex={-1}
          initial={enter}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={reduce ? { opacity: 0 } : mobile ? { opacity: 0, y: 12 } : { opacity: 0, x: 18 }}
          transition={{ duration: reduce ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={`ai-panel fixed z-40 flex max-md:pt-[env(safe-area-inset-top)] flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] outline-none transition-[inset,width,height,border-radius] duration-300 ease-out motion-reduce:transition-none ${
            fullscreen
              ? "inset-0 md:inset-3 md:left-20 md:rounded-2xl"
              : "inset-x-0 bottom-0 top-0 md:inset-auto md:bottom-4 md:right-4 md:h-[min(680px,calc(100dvh-5.5rem))] md:w-[min(430px,calc(100vw-2rem))] md:rounded-2xl"
          }`}
        >
          <TradeFixAIHeader />
          <div className="relative min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col" inert={historyOpen}>
              <TradeFixAIChat />
            </div>
            {historyOpen ? <TradeFixAIHistory /> : null}
          </div>
          <TradeFixAIInput />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
