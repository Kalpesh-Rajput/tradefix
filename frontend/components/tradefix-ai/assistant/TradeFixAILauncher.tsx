"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";

export function TradeFixAILauncher() {
  const { open, unread, toggle } = useTradeFixAssistant();
  const reduce = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6">
      <motion.div
        className="group pointer-events-auto relative"
        initial={reduce ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {open ? null : (
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-[calc(100%+8px)] right-0 whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            Ask TradeFix AI
          </span>
        )}
        <button
          ref={buttonRef}
          id="tradefix-ai-launcher"
          type="button"
          onClick={toggle}
          aria-label="Open TradeFix AI"
          aria-expanded={open}
          aria-controls="tradefix-ai-widget"
          className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#7C5CBF]/35 bg-white shadow-[0_8px_20px_-8px_rgba(91,70,150,0.55)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-[#7C5CBF]/60 hover:shadow-[0_12px_24px_-8px_rgba(91,70,150,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:translate-y-0 active:scale-[0.97] motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:h-16 md:w-16"
        >
          <Image
            src="/logo.png"
            alt=""
            width={64}
            height={64}
            className="h-full w-full rounded-full object-cover"
            priority={false}
          />
          {unread && !open ? (
            <span
              className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white"
              aria-hidden
            />
          ) : null}
        </button>
      </motion.div>
    </div>
  );
}
