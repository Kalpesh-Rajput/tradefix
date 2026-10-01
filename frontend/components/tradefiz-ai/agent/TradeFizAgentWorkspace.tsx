"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowLeft, Menu, SquarePen } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AssistantMessage, UserMessage } from "@/components/ai/AiMessage";
import { answerPlainText } from "@/components/ai/format";
import { ThinkingIndicator } from "@/components/ai/ThinkingIndicator";
import { followUpQuestions } from "@/components/ai/thinking";
import { holdTranscriptScroll, isTranscriptScroll, useTranscriptFollow } from "@/components/ai/liveTranscript";
import { AiMark } from "@/components/ai/AiMark";
import { useToast } from "@/components/ui/Toast";
import { recallScroll, rememberScroll } from "@/lib/ai/conversations";

import { AgentComposer } from "./AgentComposer";
import { AgentSidebar } from "./AgentSidebar";
import { useTradeFizAgent } from "./TradeFizAgentProvider";

const claimedQuestions = new Map<string, number>();

function claimQuestion(question: string) {
  const now = Date.now();
  const last = claimedQuestions.get(question);
  if (last && now - last < 1200) return false;
  claimedQuestions.set(question, now);
  return true;
}

export function TradeFizAgentWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ conversationId?: string[] }>();
  const param = params.conversationId?.[0] ?? null;
  const toast = useToast();
  const reduce = useReducedMotion();
  const {
    ready,
    question,
    setQuestion,
    thread,
    lastQuestion,
    pending,
    focusTick,
    conversationId,
    conversations,
    submitQuestion,
    stopReply,
    retryLast,
    editMessage,
    reactTo,
    beginFresh,
    hydrate,
    askFresh,
    currentConversationId,
  } = useTradeFizAgent();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const seenParam = useRef<string | null | undefined>(undefined);
  const syncedId = useRef<string | null>(null);

  const empty = thread.length === 0 && !pending;
  const latestAssistantId = [...thread].reverse().find((item) => item.role === "assistant" && !item.error)?.id;

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (!q || !claimQuestion(q)) return;
    const id = askFresh(q);
    router.replace(`/tradefiz-ai/chat/${id}`, { scroll: false });
  }, [searchParams, askFresh, router]);

  useEffect(() => {
    if (!ready || searchParams.get("q")?.trim()) return;
    if (seenParam.current === param) return;
    seenParam.current = param;
    if (!param || param === currentConversationId()) return;
    const found = conversations.find((item) => item.id === param);
    if (!found) {
      beginFresh("");
      router.replace("/tradefiz-ai/chat", { scroll: false });
      return;
    }
    hydrate(found.id, found.messages);
  }, [ready, param, conversations, searchParams, currentConversationId, beginFresh, hydrate, router]);

  useEffect(() => {
    if (searchParams.get("q")?.trim()) return;
    if (thread.length === 0) return;
    if (param === conversationId) return;
    if (param) return;
    if (syncedId.current === conversationId) return;
    syncedId.current = conversationId;
    router.replace(`/tradefiz-ai/chat/${conversationId}`, { scroll: false });
  }, [thread.length, conversationId, param, searchParams, router]);

  useLayoutEffect(() => {
    const root = scrollerRef.current;
    const saved = recallScroll(conversationId);
    if (!root) return;
    if (typeof saved === "number") {
      root.scrollTop = saved;
      const gap = root.scrollHeight - root.scrollTop - root.clientHeight;
      stickRef.current = gap < 120;
      setAwayFromBottom(!stickRef.current);
      return;
    }
    root.scrollTop = root.scrollHeight;
    stickRef.current = true;
    setAwayFromBottom(false);
  }, [conversationId]);

  useTranscriptFollow(scrollerRef, stickRef);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !stickRef.current) return;
    holdTranscriptScroll(() => {
      root.scrollTop = root.scrollHeight;
    });
  }, [thread, pending]);

  useEffect(() => {
    if (!historyOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setHistoryOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  function onScroll() {
    const root = scrollerRef.current;
    if (!root) return;
    if (isTranscriptScroll()) {
      rememberScroll(conversationId, root.scrollTop);
      return;
    }
    rememberScroll(conversationId, root.scrollTop);
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
      behavior: reduce ? "auto" : "smooth",
    });
  }

  function newConversation() {
    beginFresh("");
    setHistoryOpen(false);
    seenParam.current = null;
    router.push("/tradefiz-ai/chat");
  }

  function openConversation(id: string) {
    if (id === currentConversationId()) {
      setHistoryOpen(false);
      return;
    }
    const found = conversations.find((item) => item.id === id);
    if (!found) return;
    hydrate(found.id, found.messages);
    setHistoryOpen(false);
    seenParam.current = id;
    router.push(`/tradefiz-ai/chat/${id}`);
  }

  async function copyAnswer(text: string) {
    try {
      await navigator.clipboard.writeText(answerPlainText(text));
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy that answer");
    }
  }

  const sidebar = (
    <AgentSidebar className="h-full" activeId={conversationId} onNew={newConversation} onSelect={openConversation} />
  );

  return (
    <motion.div
      className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-[var(--color-surface)]"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
    >
      <div className="hidden h-full min-h-0 lg:flex">{sidebar}</div>
      {historyOpen ? (
        <div className="absolute inset-0 z-30 lg:hidden">
          <button type="button" aria-label="Close chat history" className="absolute inset-0 bg-black/30" onClick={() => setHistoryOpen(false)} />
          <AgentSidebar
            className="absolute inset-y-0 left-0 h-full max-w-[85vw] shadow-sm"
            activeId={conversationId}
            onNew={newConversation}
            onSelect={openConversation}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)] lg:hidden"
              aria-label="Open chat history"
              onClick={() => setHistoryOpen(true)}
            >
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => router.push("/tradefiz-ai")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
              aria-label="Back to TradeFix AI"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-5 text-[var(--color-text-primary)]">TradeFix AI</p>
              <p className="truncate text-[12px] leading-4 text-[var(--color-text-tertiary)]">Your Personal Trading Intelligence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={newConversation}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[12px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:bg-[var(--color-primary-very-light)] hover:text-[var(--color-text-primary)]"
          >
            <SquarePen className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span className="hidden sm:inline">New conversation</span>
            <span className="sm:hidden">New</span>
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={scrollerRef} onScroll={onScroll} className="h-full overflow-y-auto [overflow-anchor:none]">
            <div className="mx-auto flex min-h-full w-full max-w-[840px] flex-col px-4 py-6 sm:px-6">
              {empty ? (
                <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                  <AiMark size={40} />
                  <p className="mt-4 text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">TradeFix AI</p>
                  <p className="mt-1 max-w-sm text-[14px] leading-6 text-[var(--color-text-secondary)]">
                    Ask about your trades, setups, rules, and performance.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5 pb-4">
                  {thread.map((message) => {
                    const isLatest = message.id === latestAssistantId;
                    return (
                      <div key={message.id} id={`ai-msg-${message.id}`}>
                        {message.role === "user" ? (
                          <UserMessage text={message.text} onEdit={pending ? undefined : () => editMessage(message.id)} />
                        ) : (
                          <AssistantMessage
                            appearance="agent"
                            message={message}
                            onRetry={message.error ? retryLast : undefined}
                            onCopy={message.error ? undefined : () => void copyAnswer(message.text)}
                            onRegenerate={!message.error && isLatest && !pending ? retryLast : undefined}
                            onReact={message.error ? undefined : (reaction) => reactTo(message.id, reaction)}
                            followUps={!message.error && isLatest && !pending ? followUpQuestions(lastQuestion || "") : undefined}
                            onFollowUp={(next) => void submitQuestion(next)}
                          />
                        )}
                      </div>
                    );
                  })}
                  {pending ? <ThinkingIndicator variant="agent" question={lastQuestion || question} /> : null}
                  {!pending && thread.at(-1)?.role === "user" ? (
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
              className="absolute bottom-3 left-1/2 z-10 inline-flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-medium text-[var(--color-text-secondary)] shadow-sm transition hover:text-[var(--color-text-primary)]"
            >
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
              Latest
            </button>
          ) : null}
        </div>

        <AgentComposer
          value={question}
          onChange={setQuestion}
          onSubmit={() => void submitQuestion(question)}
          onStop={stopReply}
          onPrompt={(next) => void submitQuestion(next)}
          pending={pending}
          focusTick={focusTick}
          showPrompts={empty && !question.trim()}
        />
      </div>
    </motion.div>
  );
}
