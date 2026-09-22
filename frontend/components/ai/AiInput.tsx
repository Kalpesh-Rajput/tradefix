"use client";

import clsx from "clsx";
import { Lock, Send, Smile, Sparkles, Square } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

const EMOJIS = ["😊", "👍", "🔥", "📈", "📉", "🎯", "🧠", "✨", "💡", "📊", "⚠️", "🤔", "💪", "🙏", "😅", "⏱️"];

const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] disabled:opacity-40";

export function AiInput({
  value,
  onChange,
  onSubmit,
  onStop,
  onPrompt,
  pending = false,
  prompts = [],
  focusTick = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onPrompt: (question: string) => void;
  pending?: boolean;
  prompts?: { id: string; title: string; question: string }[];
  focusTick?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    if (!focusTick) return;
    textareaRef.current?.focus();
  }, [focusTick]);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 sm:px-6">
      <form
        className="mx-auto max-w-3xl pb-[max(0px,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSubmit();
        }}
      >
        <div
          className={clsx(
            "ai-input-shell rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-sm transition duration-200"
          )}
        >
          <label htmlFor="tradefix-ai-input" className="sr-only">
            Ask TradeFix AI anything
          </label>
          <textarea
            id="tradefix-ai-input"
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask TradeFix AI anything..."
            className="max-h-40 min-h-[44px] w-full resize-none bg-transparent py-2 text-[14px] leading-5 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
          <div className="flex items-center justify-between gap-2 pb-0.5">
            <div className="flex items-center gap-1.5">
            <PromptButton prompts={prompts} disabled={pending} onPick={onPrompt} />
            <EmojiButton
              onPick={(emoji) => {
                const el = textareaRef.current;
                if (!el) {
                  onChange(`${value}${emoji}`);
                  return;
                }
                const start = el.selectionStart ?? value.length;
                const end = el.selectionEnd ?? value.length;
                const next = value.slice(0, start) + emoji + value.slice(end);
                onChange(next);
                requestAnimationFrame(() => {
                  el.focus();
                  const pos = start + emoji.length;
                  el.setSelectionRange(pos, pos);
                });
              }}
            />
            </div>
            <div className="flex items-center gap-1.5">
              {pending ? (
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop reply"
                  title="Stop"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-primary-very-light)]"
                >
                  <Square className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send"
                title="Send"
                className={clsx(
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl transition duration-150",
                  canSend
                    ? "bg-primary text-white text-on-accent hover:bg-primary-hover active:scale-[0.97]"
                    : "bg-[var(--color-primary-very-light)] text-[var(--color-text-muted)]"
                )}
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
          Your TradeFix data stays private to your account.
        </p>
      </form>
    </div>
  );
}

function PromptButton({
  prompts,
  disabled,
  onPick,
}: {
  prompts: { id: string; title: string; question: string }[];
  disabled?: boolean;
  onPick: (question: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || prompts.length === 0}
        aria-label="Suggested questions"
        title="Suggested questions"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={iconBtn}
      >
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {open ? (
        <div
          id={panelId}
          role="listbox"
          aria-label="Suggested questions"
          className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-[min(100vw-2rem,320px)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-dropdown"
        >
          {prompts.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              role="option"
              className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left hover:bg-[var(--color-primary-very-light)]"
              onClick={() => {
                onPick(prompt.question);
                setOpen(false);
              }}
            >
              <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{prompt.title}</span>
              <span className="text-[12px] leading-4 text-[var(--color-text-tertiary)]">{prompt.question}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Add emoji"
        title="Add emoji"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={iconBtn}
      >
        <Smile className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {open ? (
        <div
          id={panelId}
          role="listbox"
          aria-label="Emoji"
          className="absolute bottom-[calc(100%+8px)] left-0 z-20 grid w-[220px] grid-cols-8 gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-dropdown"
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-label={emoji}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] hover:bg-[var(--color-primary-very-light)]"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
