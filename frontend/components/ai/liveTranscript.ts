"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const MS_PER_CHAR = 12;
const GROW = "tradefiz-transcript-grow";

const fresh = new Set<string>();
const openIds = new Set<string>();
const finished = new Set<string>();
const progress = new Map<string, number>();
const listeners = new Set<() => void>();
let scrollLock = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeTranscript(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markLiveTranscript(id: string) {
  finished.delete(id);
  fresh.add(id);
  openIds.add(id);
  progress.delete(id);
}

export function closeLiveTranscript(id: string) {
  if (!openIds.delete(id)) return;
  emit();
}

export function settleTranscript(id: string) {
  fresh.delete(id);
  openIds.delete(id);
  progress.delete(id);
  finished.add(id);
  emit();
}

export function isLiveTranscript(id: string) {
  return fresh.has(id) && !finished.has(id);
}

export function isTranscriptOpen(id: string) {
  return openIds.has(id);
}

export function notifyTranscriptGrowth() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GROW));
}

export function holdTranscriptScroll(run: () => void) {
  scrollLock += 1;
  try {
    run();
  } finally {
    window.requestAnimationFrame(() => {
      scrollLock = Math.max(0, scrollLock - 1);
    });
  }
}

export function isTranscriptScroll() {
  return scrollLock > 0;
}

/** Close unfinished markdown so a partial reply still renders as structured text. */
export function prepareStreamingMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const last = lines[lines.length - 1]?.trim() ?? "";
  if (last.startsWith("|") && !last.endsWith("|")) lines.pop();
  let body = lines.join("\n");
  const fences = body.match(/```/g);
  if (fences && fences.length % 2 === 1) body += "\n```";
  const bolds = body.match(/\*\*/g);
  if (bolds && bolds.length % 2 === 1) body += "**";
  return body;
}

export function useLiveTranscript(id: string, text: string, active: boolean) {
  const reduce = useReducedMotion();
  const textRef = useRef(text);
  textRef.current = text;
  const streamMode = useRef(false);
  const seenText = useRef<string | null>(null);
  const [shown, setShown] = useState(() => {
    if (!active || reduce) return text.length;
    return progress.get(id) ?? Math.min(1, text.length);
  });
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [settled, setSettled] = useState(() => !active || Boolean(reduce));

  useEffect(() => {
    if (!active || reduce) {
      seenText.current = text;
      return;
    }
    if (seenText.current === null) {
      seenText.current = text;
      return;
    }
    if (seenText.current === text) return;
    seenText.current = text;
    streamMode.current = true;
    shownRef.current = text.length;
    progress.set(id, text.length);
    setShown(text.length);
  }, [text, active, reduce, id]);

  useEffect(() => {
    if (!active || reduce) {
      shownRef.current = textRef.current.length;
      setShown(textRef.current.length);
      return;
    }

    let raf = 0;
    let last = performance.now();
    let bank = 0;

    const tick = (now: number) => {
      const goal = textRef.current.length;
      if (streamMode.current) {
        if (shownRef.current !== goal) {
          shownRef.current = goal;
          progress.set(id, goal);
          setShown(goal);
        }
        if (isTranscriptOpen(id)) raf = window.requestAnimationFrame(tick);
        return;
      }

      bank += now - last;
      last = now;
      const room = goal - shownRef.current;
      const chars = Math.min(room, Math.floor(bank / MS_PER_CHAR));
      if (chars > 0) {
        bank -= chars * MS_PER_CHAR;
        shownRef.current += chars;
        progress.set(id, shownRef.current);
        setShown(shownRef.current);
      }
      if (shownRef.current < goal || isTranscriptOpen(id)) {
        raf = window.requestAnimationFrame(tick);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active, reduce, id]);

  useEffect(() => {
    if (!active || reduce) {
      setSettled(true);
      return;
    }
    if (isTranscriptOpen(id) || shown < text.length) {
      setSettled(false);
      return;
    }
    settleTranscript(id);
    setSettled(true);
  }, [active, reduce, shown, text.length, id]);

  const wasActive = useRef(active);
  useLayoutEffect(() => {
    if (active || wasActive.current) notifyTranscriptGrowth();
    wasActive.current = active;
  }, [shown, settled, active]);

  const streaming = Boolean(active && !settled && !reduce);
  return {
    visible: streaming ? text.slice(0, shown) : text,
    streaming,
    settled: !streaming,
  };
}

export function useTranscriptSettled(id: string | null | undefined) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeTranscript(() => setTick((value) => value + 1)), []);
  if (!id) return true;
  return !isLiveTranscript(id);
}

export function useTranscriptFollow(
  scrollerRef: RefObject<HTMLElement | null>,
  stickRef: { current: boolean }
) {
  useEffect(() => {
    function onGrow() {
      const root = scrollerRef.current;
      if (!root || !stickRef.current) return;
      holdTranscriptScroll(() => {
        root.scrollTop = root.scrollHeight;
      });
    }
    window.addEventListener(GROW, onGrow);
    return () => window.removeEventListener(GROW, onGrow);
  }, [scrollerRef, stickRef]);
}
