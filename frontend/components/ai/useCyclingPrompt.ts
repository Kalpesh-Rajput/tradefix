"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const TYPE_MS_MIN = 45;
const TYPE_MS_MAX = 65;
const DELETE_MS_MIN = 25;
const DELETE_MS_MAX = 40;
const HOLD_MS = 2000;
const GAP_MS = 400;
const START_DELAY_MS = 280;

function stepMs(min: number, max: number, index: number) {
  const span = max - min;
  return min + ((index * 7) % (span + 1));
}

export function useCyclingPrompt(prompts: readonly string[], paused: boolean) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");

  useEffect(() => {
    if (paused || reduce || prompts.length === 0) {
      setText("");
      return;
    }

    let cancelled = false;
    let promptIndex = 0;
    let timer = 0;

    const schedule = (fn: () => void, ms: number) => {
      timer = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const typePrompt = () => {
      if (cancelled) return;
      const full = prompts[promptIndex] ?? "";
      let char = 0;

      const typeNext = () => {
        if (cancelled) return;
        char += 1;
        setText(full.slice(0, char));
        if (char < full.length) {
          schedule(typeNext, stepMs(TYPE_MS_MIN, TYPE_MS_MAX, char));
          return;
        }
        schedule(deletePrompt, HOLD_MS);
      };

      const deletePrompt = () => {
        if (cancelled) return;
        let remaining = full.length;

        const deleteNext = () => {
          if (cancelled) return;
          remaining -= 1;
          setText(full.slice(0, Math.max(remaining, 0)));
          if (remaining > 0) {
            schedule(deleteNext, stepMs(DELETE_MS_MIN, DELETE_MS_MAX, remaining));
            return;
          }
          promptIndex = (promptIndex + 1) % prompts.length;
          schedule(typePrompt, GAP_MS);
        };

        deleteNext();
      };

      if (full.length === 0) {
        promptIndex = (promptIndex + 1) % prompts.length;
        schedule(typePrompt, GAP_MS);
        return;
      }

      setText("");
      schedule(typeNext, stepMs(TYPE_MS_MIN, TYPE_MS_MAX, 0));
    };

    schedule(typePrompt, START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [paused, prompts, reduce]);

  const active = !paused && !reduce;

  return { text, active, showCursor: active };
}
