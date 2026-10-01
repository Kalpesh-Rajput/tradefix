"use client";

import clsx from "clsx";
import { ArrowUp, Loader2, Sparkles, Square } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { useCyclingPrompt } from "@/components/ai/useCyclingPrompt";

export const TRADEFIZ_COMPOSER_PLACEHOLDER = "Ask TradeFiz AI anything...";

const CYCLING_PROMPTS = [
  TRADEFIZ_COMPOSER_PLACEHOLDER,
  "Where am I losing money?",
  "Analyze my last 30 days",
  "What's my strongest setup?",
  "Why am I breaking my trading rules?",
  "What should I focus on?",
] as const;

const MAX_HEIGHT = 160;

export type TradeFizPrompt = {
  label: string;
  question: string;
};

export const tradefizPromptPillClass =
  "rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-left text-[12.5px] font-medium leading-5 text-[var(--color-text-secondary)] transition-colors duration-150 hover:border-primary/30 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";

export function TradeFizAIComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  placeholder = TRADEFIZ_COMPOSER_PLACEHOLDER,
  disabled = false,
  loading = false,
  autoFocus = false,
  variant = "full",
  focusTick = 0,
  prompts,
  onPrompt,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  variant?: "full" | "compact";
  focusTick?: number;
  prompts?: TradeFizPrompt[];
  onPrompt?: (question: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const [focused, setFocused] = useState(false);
  const compact = variant === "compact";
  const canSend = value.trim().length > 0 && !disabled && !loading;
  const cycling = useCyclingPrompt(CYCLING_PROMPTS, focused || value.length > 0 || disabled || loading);
  const showCycle = !focused && value.length === 0 && !disabled && !loading && cycling.active;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.minHeight = "0px";
    el.style.height = "0px";
    const full = el.scrollHeight;
    const next = Math.min(full, MAX_HEIGHT);
    el.style.minHeight = "";
    el.style.height = `${Math.max(next, 44)}px`;
    el.style.overflowY = full > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  useEffect(() => {
    if (!focusTick) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [focusTick]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  }

  return (
    <form
      className={compact ? "w-full" : "mx-auto w-[calc(100%-24px)] max-w-[820px]"}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      {prompts && prompts.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={`${prompt.label}:${prompt.question}`}
              type="button"
              disabled={disabled || loading}
              onClick={() => onPrompt?.(prompt.question)}
              className={tradefizPromptPillClass}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={clsx(
          "flex items-end gap-2 rounded-[16px] border border-[var(--color-border)] bg-white",
          "shadow-[0_1px_2px_rgba(20,21,26,0.04),0_8px_24px_rgba(20,21,26,0.04)]",
          "transition-[border-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          "hover:border-[color-mix(in_srgb,var(--color-primary)_22%,var(--color-border))]",
          "focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(91,70,150,0.14),0_8px_24px_rgba(20,21,26,0.04)]",
          "focus-within:hover:border-primary",
          compact ? "p-2" : "p-2.5 sm:p-3"
        )}
      >
        <Sparkles
          className="mt-3.5 h-4 w-4 shrink-0 self-start text-[var(--color-text-muted)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="relative min-w-0 flex-1">
          <label htmlFor={inputId} className="sr-only">
            {placeholder}
          </label>
          {showCycle ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-2.5 line-clamp-2 text-[15px] leading-6 text-[var(--color-text-muted)]"
            >
              {cycling.text}
              {cycling.showCursor ? <span className="ai-prompt-caret" /> : null}
            </span>
          ) : null}
          <textarea
            id={inputId}
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={showCycle ? "" : placeholder}
            className="max-h-40 min-h-11 w-full resize-none appearance-none overflow-hidden border-0 bg-transparent py-2.5 text-[15px] leading-6 text-[var(--color-text-primary)] shadow-none outline-none ring-0 placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-0 focus:!shadow-none focus-visible:outline-none focus-visible:!shadow-none disabled:cursor-not-allowed"
          />
        </div>
        {loading && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop reply"
            title="Stop"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-very-light)] text-primary transition duration-150 ease-out hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:!shadow-[0_0_0_3px_rgba(91,70,150,0.16)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <Square className="block h-3.5 w-3.5 fill-current" strokeWidth={2} />
          </button>
        ) : loading ? (
          <button
            type="button"
            disabled
            aria-label="Sending"
            className="inline-flex h-10 w-10 shrink-0 cursor-wait items-center justify-center rounded-full bg-[var(--color-primary-very-light)] text-primary"
          >
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            title="Send"
            className={clsx(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition duration-150 ease-out focus-visible:outline-none focus-visible:!shadow-[0_0_0_3px_rgba(91,70,150,0.18)] motion-reduce:transition-none motion-reduce:active:scale-100",
              canSend
                ? "bg-primary text-white text-on-accent shadow-[0_1px_2px_rgba(91,70,150,0.28)] hover:bg-primary-hover hover:shadow-[0_4px_12px_rgba(91,70,150,0.28)] active:scale-[0.96]"
                : "cursor-not-allowed bg-[var(--color-primary-very-light)] text-[var(--color-text-muted)]"
            )}
          >
            <ArrowUp className="block h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>
        )}
      </div>
    </form>
  );
}
