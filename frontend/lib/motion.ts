/** Shared motion timings. Route enters use CSS so the transform does not linger. */

import type { TargetAndTransition, Transition } from "framer-motion";

/** Seconds. Mirrors --duration-* in globals.css. */
export const DURATION = { fast: 0.14, base: 0.2, panel: 0.26 } as const;
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const base: Transition = { duration: DURATION.base, ease: EASE_OUT };
const fast: Transition = { duration: DURATION.fast, ease: EASE_OUT };

type Preset = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
};

/** framer-motion presets. Spread onto a `motion.*` element inside `AnimatePresence`. */
export const MOTION: Record<"fade" | "fadeUp" | "dropdown" | "dropup" | "modal" | "drawerLeft" | "toast", Preset> = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: fast },
  fadeUp: { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4 }, transition: base },
  dropdown: {
    initial: { opacity: 0, y: -4, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -2, scale: 0.98 },
    transition: fast,
  },
  dropup: {
    initial: { opacity: 0, y: 4, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 2, scale: 0.98 },
    transition: fast,
  },
  modal: {
    initial: { opacity: 0, y: 8, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 4, scale: 0.985 },
    transition: { duration: DURATION.panel, ease: EASE_OUT },
  },
  drawerLeft: {
    initial: { x: "-100%" },
    animate: { x: 0 },
    exit: { x: "-100%" },
    transition: { duration: DURATION.panel, ease: EASE_OUT },
  },
  toast: {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, x: 24, scale: 0.98 },
    transition: base,
  },
};

/** Opacity-only version of a preset for users who prefer reduced motion. */
export function reducedPreset(preset: Preset, reduce: boolean | null): Preset {
  if (!reduce) return preset;
  return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.01 } };
}

export const PAGE_ENTER_MS = 280;
export const REVEAL_MS = 220;
export const REVEAL_STAGGER_MS = 40;
export const REVEAL_STAGGER_CAP = 8;

const CHAT_WORKSPACE = "/tradefiz-ai/chat";

/**
 * Route key for the page entrance.
 * Query strings and hashes are ignored so filters and tabs do not replay it.
 * TradeFiz chat conversation ids share one workspace page, so they share one key.
 */
export function pageTransitionKey(pathname: string): string {
  const raw = pathname.trim() || "/";
  const withoutHash = raw.split("#")[0] || "/";
  const pathOnly = withoutHash.split("?")[0] || "/";
  const normalized = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const path = normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;

  if (path === CHAT_WORKSPACE || path.startsWith(`${CHAT_WORKSPACE}/`)) {
    return CHAT_WORKSPACE;
  }
  return path;
}
