"use client";

import { ArrowDown, SquarePen } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AiHeader } from "@/components/ai/AiHeader";
import { AiInput } from "@/components/ai/AiInput";
import { AssistantMessage, UserMessage } from "@/components/ai/AiMessage";
import { ConversationHistory } from "@/components/ai/ConversationHistory";
import { ThinkingIndicator } from "@/components/ai/ThinkingIndicator";
import { answerPlainText } from "@/components/ai/format";
import { followUpQuestions, pendingStatusLabel } from "@/components/ai/thinking";
import { BASE_PROMPTS, personalizedPrompts } from "@/components/ai/suggestions";
import { WeeklyInsightCard } from "@/components/ai/WeeklyInsightCard";
import { WelcomeState } from "@/components/ai/WelcomeState";
import { PortfolioSwitcher } from "@/components/dashboard/PortfolioSwitcher";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useToast } from "@/components/ui/Toast";
import { useCoachStatus, useCoachWeekly } from "@/lib/hooks/useCoach";
import { useAiThread } from "@/lib/hooks/useAiThread";

export function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { activeAccount } = useAccountPrefs();
  const accountId = activeAccount?.id;

  const { data: status, isLoading: statusLoading } = useCoachStatus(accountId);
  const { data: weekly, isLoading: weeklyLoading } = useCoachWeekly(accountId);
  const {
    question,
    setQuestion,
    thread,
    lastQuestion,
    activeId,
    setActiveId,
    pending,
    stopped,
    focusTick,
    submitQuestion,
    stopReply,
    retryLast,
    editMessage,
    reactTo,
    reset,
  } = useAiThread();

  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const autoAsked = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const reduceMotion = useReducedMotion();

  const empty = thread.length === 0 && !pending;
  const prompts = useMemo(
    () => [...personalizedPrompts(weekly), ...BASE_PROMPTS].slice(0, 8),
    [weekly]
  );

  useEffect(() => {
    if (pending) stickRef.current = true;
  }, [pending]);

  useEffect(() => {
    if (autoAsked.current) return;
    const q = searchParams.get("q")?.trim();
    if (!q) return;
    autoAsked.current = true;
    void submitQuestion(q);
  }, [searchParams, submitQuestion]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !stickRef.current) return;
    root.scrollTo({ top: root.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [thread, pending, reduceMotion]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root) return;
    const gap = root.scrollHeight - root.scrollTop - root.clientHeight;
    const near = gap < 120;
    stickRef.current = near;
    setAwayFromBottom(!near);
  }

  function jumpToLatest() {
    stickRef.current = true;
    setAwayFromBottom(false);
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  async function copyAnswer(text: string) {
    try {
      await navigator.clipboard.writeText(answerPlainText(text));
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy that answer");
    }
  }

  const newConversation = useCallback(() => {
    reset();
    if (searchParams.get("q")) router.replace("/chat");
  }, [reset, router, searchParams]);

  function scrollToMessage(id: string) {
    setActiveId(id);
    const el = document.getElementById(`ai-msg-${id}`);
    el?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }

  const headerActions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={newConversation}
          disabled={thread.length === 0 && !question && !pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
          aria-label="New conversation"
          title="New conversation"
        >
          <SquarePen className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">New conversation</span>
        </button>
        <PortfolioSwitcher className="[&_button]:h-8 [&_button]:min-w-0 [&_button]:max-w-[168px] [&_button]:rounded-md [&_button]:border-[var(--color-border)] [&_button]:bg-[var(--color-surface)] [&_button]:px-2.5 [&_button]:text-[11px] [&_button]:shadow-none" />
      </div>
    ),
    [newConversation, pending, question, thread.length]
  );

  const latestAssistantId = [...thread].reverse().find((item) => item.role === "assistant" && !item.error)?.id;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-background)]">
      <HeaderActions subtitle="Your Personal Trading Intelligence">{headerActions}</HeaderActions>
      <div className="flex min-h-0 flex-1">
        {thread.length > 0 ? (
          <ConversationHistory messages={thread} activeId={activeId} onSelect={scrollToMessage} />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
          <div ref={scrollerRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 sm:px-6">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col py-5">
              <AiHeader
                compact={!empty}
                pending={pending}
                pendingLabel={pendingStatusLabel(lastQuestion || question)}
              />
              <div className={empty ? "mb-5" : "mb-4"}>
                <WeeklyInsightCard weekly={weekly} loading={weeklyLoading} compact={!empty} />
              </div>
              {empty ? (
                <WelcomeState
                  weekly={weekly}
                  tradeCount={statusLoading ? null : status?.trades ?? 0}
                  onAsk={(q) => void submitQuestion(q)}
                />
              ) : (
                <div className="flex flex-col gap-4 pb-4">
                  {thread.map((message) => {
                    const isLatest = message.id === latestAssistantId;
                    return (
                      <div key={message.id} id={`ai-msg-${message.id}`}>
                        {message.role === "user" ? (
                          <UserMessage text={message.text} onEdit={pending ? undefined : () => editMessage(message.id)} />
                        ) : (
                          <AssistantMessage
                            message={message}
                            onRetry={message.error ? retryLast : undefined}
                            onCopy={message.error ? undefined : () => void copyAnswer(message.text)}
                            onRegenerate={!message.error && isLatest && !pending ? retryLast : undefined}
                            onReact={message.error ? undefined : (reaction) => reactTo(message.id, reaction)}
                            followUps={!message.error && isLatest && !pending ? followUpQuestions(lastQuestion || "") : undefined}
                            onFollowUp={(q) => void submitQuestion(q)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {pending ? <ThinkingIndicator question={lastQuestion || question} /> : null}
                  {stopped && !pending && thread.at(-1)?.role === "user" ? (
                    <button
                      type="button"
                      onClick={retryLast}
                      className="ml-10 inline-flex h-8 w-fit items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {awayFromBottom && !empty ? (
            <button
              type="button"
              onClick={jumpToLatest}
              aria-label="Jump to latest"
              title="Latest"
              className="absolute bottom-3 left-1/2 z-10 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] shadow-sm transition hover:text-[var(--color-text-primary)]"
            >
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
              Latest
            </button>
          ) : null}
          </div>
          <AiInput
            value={question}
            onChange={setQuestion}
            onSubmit={() => void submitQuestion(question)}
            onStop={stopReply}
            onPrompt={(q) => void submitQuestion(q)}
            pending={pending}
            prompts={prompts}
            focusTick={focusTick}
          />
        </div>
      </div>
    </div>
  );
}
