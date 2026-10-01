"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { ThreadMessage } from "@/components/ai/types";
import { closeLiveTranscript, markLiveTranscript, settleTranscript } from "@/components/ai/liveTranscript";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { ApiError } from "@/lib/api";
import { useCoachAsk } from "@/lib/hooks/useCoach";

const REQUEST_TIMEOUT_MS = 28_000;

function messageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}`;
}

function questionForApi(question: string, viewContext: string | null | undefined) {
  const note = viewContext?.trim();
  if (!note) return question;
  const withNote = `${question}\n\nView context (use only if it helps the answer; do not repeat it):\n${note}`;
  return withNote.length <= 2000 ? withNote : question;
}

export function useAiThread(options?: { viewContext?: () => string | null }) {
  const { activeAccount } = useAccountPrefs();
  const accountId = activeAccount?.id;
  const ask = useCoachAsk();
  const askRef = useRef(ask.mutateAsync);
  askRef.current = ask.mutateAsync;
  const viewContextRef = useRef(options?.viewContext);
  viewContextRef.current = options?.viewContext;

  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [conversationId, setConversationId] = useState(() => messageId("c"));
  const conversationIdRef = useRef(conversationId);

  const sending = useRef(false);
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const stopKind = useRef<"user" | "timeout" | null>(null);
  const threadRef = useRef(thread);
  threadRef.current = thread;

  const submitQuestion = useCallback(
    async (raw: string, existingThread?: ThreadMessage[]) => {
      const q = raw.trim();
      if (!q) return;
      if (sending.current) {
        stopKind.current = "user";
        abortRef.current?.abort();
      }
      sending.current = true;
      stopKind.current = null;
      setStopped(false);

      const id = ++requestSeq.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const timer = window.setTimeout(() => {
        stopKind.current = "timeout";
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      const base = existingThread ?? threadRef.current;
      const userMsg: ThreadMessage = { id: messageId("u"), role: "user", text: q };
      const nextThread = [...base, userMsg];
      setThread(nextThread);
      setQuestion("");
      setLastQuestion(q);
      setActiveId(userMsg.id);
      setPending(true);

      const history = nextThread.slice(-8).map((item) => ({
        role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: item.text,
      }));

      let assistantId: string | null = null;
      try {
        const res = await askRef.current({
          question: questionForApi(q, viewContextRef.current?.()),
          account_id: accountId,
          history: history.slice(0, -1),
          signal: controller.signal,
        });
        if (requestSeq.current !== id) return;
        assistantId = messageId("a");
        markLiveTranscript(assistantId);
        setThread((current) => [
          ...current,
          {
            id: assistantId as string,
            role: "assistant",
            text: res.answer,
            actions: res.actions,
            sources: res.sources,
          },
        ]);
      } catch (err) {
        if (requestSeq.current !== id || stopKind.current === "user") return;
        const text =
          stopKind.current === "timeout"
            ? "That took too long. Try again, or ask a more specific question."
            : err instanceof ApiError && err.message
              ? err.message
              : "Something went wrong while analyzing your data. Please try again.";
        setThread((current) => [
          ...current,
          {
            id: messageId("a"),
            role: "assistant",
            text,
            error: true,
          },
        ]);
      } finally {
        window.clearTimeout(timer);
        if (assistantId) closeLiveTranscript(assistantId);
        if (requestSeq.current === id) {
          sending.current = false;
          setPending(false);
        }
      }
    },
    [accountId]
  );

  const stopReply = useCallback(() => {
    stopKind.current = "user";
    requestSeq.current += 1;
    abortRef.current?.abort();
    sending.current = false;
    setPending(false);
    setStopped(true);
  }, []);

  const retryLast = useCallback(() => {
    if (!lastQuestion || sending.current) return;
    let base = threadRef.current;
    const last = base.at(-1);
    if (last?.role === "assistant") base = base.slice(0, -1);
    const prior = base.at(-1);
    if (prior?.role === "user" && prior.text === lastQuestion) base = base.slice(0, -1);
    void submitQuestion(lastQuestion, base);
  }, [lastQuestion, submitQuestion]);

  const editMessage = useCallback((id: string) => {
    if (sending.current) return;
    const source = threadRef.current;
    const index = source.findIndex((item) => item.id === id);
    if (index < 0 || source[index].role !== "user") return;
    setQuestion(source[index].text);
    setThread(source.slice(0, index));
    setLastQuestion(null);
    setStopped(false);
    setFocusTick((value) => value + 1);
  }, []);

  const reactTo = useCallback((id: string, reaction: "up" | "down") => {
    setThread((current) =>
      current.map((item) =>
        item.id === id ? { ...item, reaction: item.reaction === reaction ? undefined : reaction } : item
      )
    );
  }, []);

  const beginFresh = useCallback((draft = "") => {
    stopKind.current = "user";
    requestSeq.current += 1;
    abortRef.current?.abort();
    sending.current = false;
    const id = messageId("c");
    conversationIdRef.current = id;
    threadRef.current = [];
    setPending(false);
    setStopped(false);
    setThread([]);
    setLastQuestion(null);
    setActiveId(null);
    setConversationId(id);
    setQuestion(draft);
    setFocusTick((value) => value + 1);
    return id;
  }, []);

  const reset = useCallback(() => {
    beginFresh("");
  }, [beginFresh]);

  const hydrate = useCallback((id: string, messages: ThreadMessage[]) => {
    stopKind.current = "user";
    requestSeq.current += 1;
    abortRef.current?.abort();
    sending.current = false;
    conversationIdRef.current = id;
    threadRef.current = messages;
    for (const message of messages) settleTranscript(message.id);
    setPending(false);
    setStopped(false);
    setThread(messages);
    setConversationId(id);
    setQuestion("");
    const lastUser = [...messages].reverse().find((item) => item.role === "user");
    setLastQuestion(lastUser?.text ?? null);
    setActiveId(messages.at(-1)?.id ?? null);
    setFocusTick((value) => value + 1);
  }, []);

  const askFresh = useCallback(
    (raw: string) => {
      const text = raw.trim();
      const id = beginFresh("");
      if (text) void submitQuestion(text, []);
      return id;
    },
    [beginFresh, submitQuestion]
  );

  const currentConversationId = useCallback(() => conversationIdRef.current, []);

  return useMemo(
    () => ({
      question,
      setQuestion,
      thread,
      lastQuestion,
      activeId,
      setActiveId,
      pending,
      stopped,
      focusTick,
      conversationId,
      submitQuestion,
      stopReply,
      retryLast,
      editMessage,
      reactTo,
      reset,
      beginFresh,
      hydrate,
      askFresh,
      currentConversationId,
    }),
    [
      question,
      thread,
      lastQuestion,
      activeId,
      pending,
      stopped,
      focusTick,
      conversationId,
      submitQuestion,
      stopReply,
      retryLast,
      editMessage,
      reactTo,
      reset,
      beginFresh,
      hydrate,
      askFresh,
      currentConversationId,
    ]
  );
}
