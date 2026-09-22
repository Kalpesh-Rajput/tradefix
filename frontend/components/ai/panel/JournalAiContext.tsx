"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useAiThread } from "@/lib/hooks/useAiThread";

type ThreadApi = ReturnType<typeof useAiThread>;

type JournalAiValue = ThreadApi & {
  open: boolean;
  fullscreen: boolean;
  historyOpen: boolean;
  selectedQuickPrompt: string | null;
  toggle: () => void;
  close: () => void;
  toggleFullscreen: () => void;
  toggleHistory: () => void;
  ask: (question: string, promptId?: string | null) => void;
  startNewChat: () => void;
};

const JournalAiContext = createContext<JournalAiValue | null>(null);

export function JournalAiProvider({ children }: { children: ReactNode }) {
  const thread = useAiThread();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedQuickPrompt, setSelectedQuickPrompt] = useState<string | null>(null);

  const toggle = useCallback(() => {
    setOpen((current) => {
      if (current) {
        setFullscreen(false);
        setHistoryOpen(false);
      }
      return !current;
    });
  }, []);

  const close = useCallback(() => {
    setFullscreen(false);
    setHistoryOpen(false);
    setOpen(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((current) => !current);
  }, []);

  const toggleHistory = useCallback(() => {
    setHistoryOpen((current) => !current);
  }, []);

  const ask = useCallback(
    (question: string, promptId?: string | null) => {
      setSelectedQuickPrompt(promptId ?? null);
      setHistoryOpen(false);
      void thread.submitQuestion(question);
    },
    [thread.submitQuestion]
  );

  const startNewChat = useCallback(() => {
    thread.reset();
    setSelectedQuickPrompt(null);
    setHistoryOpen(false);
    setFullscreen(false);
  }, [thread.reset]);

  const value = useMemo<JournalAiValue>(
    () => ({
      ...thread,
      open,
      fullscreen,
      historyOpen,
      selectedQuickPrompt,
      toggle,
      close,
      toggleFullscreen,
      toggleHistory,
      ask,
      startNewChat,
    }),
    [
      thread,
      open,
      fullscreen,
      historyOpen,
      selectedQuickPrompt,
      toggle,
      close,
      toggleFullscreen,
      toggleHistory,
      ask,
      startNewChat,
    ]
  );

  return <JournalAiContext.Provider value={value}>{children}</JournalAiContext.Provider>;
}

export function JournalAiScope({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return children;
  return <JournalAiProvider>{children}</JournalAiProvider>;
}

export function useJournalAi() {
  const ctx = useContext(JournalAiContext);
  if (!ctx) throw new Error("useJournalAi must be used within JournalAiProvider");
  return ctx;
}
