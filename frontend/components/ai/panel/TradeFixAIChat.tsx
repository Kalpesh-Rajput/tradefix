"use client";

import { ArrowDown } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { ThinkingIndicator } from "@/components/ai/ThinkingIndicator";
import { answerPlainText } from "@/components/ai/format";
import { followUpQuestions } from "@/components/ai/thinking";
import { useJournalAi } from "@/components/ai/panel/JournalAiContext";
import { TradeFixAIActionButtons } from "@/components/ai/panel/TradeFixAIActionButtons";
import { TradeFixAIMessage } from "@/components/ai/panel/TradeFixAIMessage";
import { TradeFixAIWelcome } from "@/components/ai/panel/TradeFixAIWelcome";
import { useToast } from "@/components/ui/Toast";
import type { ThreadMessage } from "@/components/ai/types";
import type { JournalTakeAction } from "@/components/ai/panel/prompts";

function suggestionActions(message: ThreadMessage): JournalTakeAction[] {
  if (message.role !== "assistant" || message.error) return [];
  const body = message.text.toLowerCase();
  return (message.actions ?? [])
    .map((action) => action.trim())
    .filter((action) => action.length > 0 && !body.includes(action.toLowerCase()))
    .slice(0, 4)
    .map((label, index) => ({
      id: `${message.id}-action-${index}`,
      label,
      question: label,
    }));
}

export function TradeFixAIChat() {
  const {
    thread,
    pending,
    stopped,
    lastQuestion,
    question,
    ask,
    retryLast,
    editMessage,
    reactTo,
  } = useJournalAi();
  const toast = useToast();
  const reduce = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [away, setAway] = useState(false);
  const empty = thread.length === 0 && !pending;

  useEffect(() => {
    if (pending) stickRef.current = true;
  }, [pending]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !stickRef.current) return;
    root.scrollTo({ top: root.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [thread, pending, reduce]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root) return;
    const gap = root.scrollHeight - root.scrollTop - root.clientHeight;
    const near = gap < 80;
    stickRef.current = near;
    setAway(!near);
  }

  async function copyAnswer(text: string) {
    try {
      await navigator.clipboard.writeText(answerPlainText(text));
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy that answer");
    }
  }

  const latestAssistantId = [...thread].reverse().find((item) => item.role === "assistant" && !item.error)?.id;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div ref={scrollerRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
        {empty ? (
          <TradeFixAIWelcome />
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            {thread.map((message) => {
              const isLatest = message.id === latestAssistantId;
              const actions = isLatest ? suggestionActions(message) : [];
              return (
                <div key={message.id} id={`ai-panel-msg-${message.id}`}>
                  <TradeFixAIMessage
                    message={message}
                    onEdit={message.role === "user" && !pending ? () => editMessage(message.id) : undefined}
                    onRetry={message.error ? retryLast : undefined}
                    onCopy={message.role === "assistant" && !message.error ? () => void copyAnswer(message.text) : undefined}
                    onRegenerate={!message.error && isLatest && !pending ? retryLast : undefined}
                    onReact={
                      message.role === "assistant" && !message.error
                        ? (reaction) => reactTo(message.id, reaction)
                        : undefined
                    }
                    followUps={!message.error && isLatest && !pending ? followUpQuestions(lastQuestion || "") : undefined}
                    onFollowUp={(q) => ask(q)}
                  />
                  {actions.length > 0 ? (
                    <div className="mt-3 pl-9">
                      <TradeFixAIActionButtons actions={actions} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {pending ? <ThinkingIndicator question={lastQuestion || question} /> : null}
            {stopped && !pending && thread.at(-1)?.role === "user" ? (
              <button
                type="button"
                onClick={retryLast}
                className="ml-10 inline-flex h-8 w-fit items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Try again
              </button>
            ) : null}
          </div>
        )}
      </div>
      {away && !empty ? (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true;
            setAway(false);
            scrollerRef.current?.scrollTo({
              top: scrollerRef.current.scrollHeight,
              behavior: reduce ? "auto" : "smooth",
            });
          }}
          aria-label="Jump to latest"
          className="absolute bottom-3 left-1/2 z-10 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] shadow-sm"
        >
          <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
          Latest
        </button>
      ) : null}
    </div>
  );
}
