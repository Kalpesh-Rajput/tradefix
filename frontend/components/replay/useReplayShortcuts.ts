"use client";

import { useEffect } from "react";

export type ReplayShortcutActions = {
  toggle: () => void;
  stepForward: () => void;
  stepBack: () => void;
  faster: () => void;
  slower: () => void;
};

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useReplayShortcuts(actions: ReplayShortcutActions | null) {
  useEffect(() => {
    if (!actions) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        actions.toggle();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        actions.stepForward();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        actions.stepBack();
      } else if (event.key === "+" || event.key === "=") {
        actions.faster();
      } else if (event.key === "-" || event.key === "_") {
        actions.slower();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);
}
