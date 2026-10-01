"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";
import { TradeFixAIComposer } from "./TradeFixAIComposer";
import { TradeFixAIHeader } from "./TradeFixAIHeader";
import { TradeFixAIHistory } from "./TradeFixAIHistory";
import { TradeFixAIThread } from "./TradeFixAIThread";

export function TradeFixAIWindow() {
  const { historyOpen, close, toggleHistory } = useTradeFixAssistant();
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const launcher = document.getElementById("tradefix-ai-launcher");
    return () => {
      if (launcher instanceof HTMLElement) launcher.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      event.preventDefault();
      if (historyOpen) {
        toggleHistory();
        return;
      }
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, historyOpen, toggleHistory]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const panel = panelRef.current;
    if (!viewport || !panel) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const base = window.matchMedia("(max-width: 767px)").matches ? 84 : 104;
      panel.style.bottom = `${base + covered}px`;
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      panel.style.bottom = "";
    };
  }, []);

  return (
    <motion.div
      ref={panelRef}
      id="tradefix-ai-widget"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tradefix-ai-widget-title"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: reduce ? 0.01 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fixed z-40 flex origin-bottom-right flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_48px_-28px_rgba(15,23,42,0.55)] outline-none max-md:bottom-[5.25rem] max-md:left-3 max-md:right-3 max-md:h-[min(640px,calc(100dvh-100px))] max-md:rounded-2xl md:bottom-[6.5rem] md:right-6 md:h-[min(640px,calc(100dvh-8.5rem))] md:max-h-[680px] md:w-[400px] md:max-w-[440px] md:rounded-[18px]"
    >
      <TradeFixAIHeader />
      <div className="relative min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col" inert={historyOpen}>
          <TradeFixAIThread />
        </div>
        {historyOpen ? <TradeFixAIHistory /> : null}
      </div>
      <TradeFixAIComposer />
    </motion.div>
  );
}
