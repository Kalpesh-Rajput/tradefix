"use client";

import clsx from "clsx";
import { Send, Square } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useJournalAi } from "@/components/ai/panel/JournalAiContext";
import { JOURNAL_ROTATING_PROMPTS } from "@/components/ai/panel/prompts";
import { useCyclingPrompt } from "@/components/ai/useCyclingPrompt";

export function TradeFixAIInput() {
  const { question, setQuestion, pending, focusTick, ask, stopReply } = useJournalAi();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const cycling = useCyclingPrompt(JOURNAL_ROTATING_PROMPTS, focused || question.length > 0 || pending);
  const canSend = question.trim().length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [question]);

  useEffect(() => {
    if (!focusTick) return;
    textareaRef.current?.focus();
  }, [focusTick]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) ask(question);
    }
  }

  const showCycle = !focused && !question && cycling.active;

  return (
    <form
      className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) ask(question);
      }}
    >
      <div className="ai-input-shell flex items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="journal-ai-input" className="sr-only">
            Ask anything about your trading
          </label>
          {showCycle ? (
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-2 line-clamp-2 text-[14px] leading-5 text-[var(--color-text-muted)]"
            >
              {cycling.text}
              {cycling.showCursor ? <span className="ai-prompt-caret" /> : null}
            </span>
          ) : null}
          <textarea
            id="journal-ai-input"
            ref={textareaRef}
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={showCycle ? "" : "Ask anything about your trading..."}
            className="max-h-[120px] min-h-[40px] w-full resize-none bg-transparent py-2 text-[14px] leading-5 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        {pending ? (
          <button
            type="button"
            onClick={stopReply}
            aria-label="Stop reply"
            title="Stop"
            className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-primary-very-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Square className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            title="Send"
            className={clsx(
              "mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              canSend
                ? "bg-primary text-white text-on-accent hover:bg-primary-hover active:scale-[0.97]"
                : "bg-[var(--color-primary-very-light)] text-[var(--color-text-muted)]"
            )}
          >
            <Send className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </form>
  );
}
