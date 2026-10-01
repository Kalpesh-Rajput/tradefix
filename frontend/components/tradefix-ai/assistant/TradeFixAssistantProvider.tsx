"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAssistantScope } from "@/lib/ai/assistant-scope";
import {
  groupConversations,
  loadConversations,
  saveConversations,
  upsertConversation,
  type StoredConversation,
} from "@/lib/ai/conversations";
import { assistantPage, formatViewContext } from "@/lib/ai/page-context";
import { useAiThread } from "@/lib/hooks/useAiThread";

type ThreadApi = ReturnType<typeof useAiThread>;

type AssistantValue = ThreadApi & {
  ready: boolean;
  conversations: StoredConversation[];
  grouped: ReturnType<typeof groupConversations>;
  open: boolean;
  historyOpen: boolean;
  unread: boolean;
  pageLabel: string;
  prompts: ReturnType<typeof assistantPage>["prompts"];
  toggle: () => void;
  close: () => void;
  toggleHistory: () => void;
  ask: (question: string) => void;
  openAndAsk: (question: string) => void;
  openFull: () => void;
  startNewChat: () => void;
  selectConversation: (id: string) => void;
};

export const TradeFixAssistantContext = createContext<AssistantValue | null>(null);

export function TradeFixAssistantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeAccount } = useAccountPrefs();
  const pathname = usePathname();
  const router = useRouter();
  const scope = useAssistantScope();
  const userId = user?.id ?? null;
  const onAgentRoute = pathname === "/tradefiz-ai" || pathname?.startsWith("/tradefiz-ai/");

  const contextRef = useRef("");
  contextRef.current = formatViewContext(pathname, activeAccount?.name, scope);
  const thread = useAiThread({ viewContext: () => contextRef.current || null });

  const [activated, setActivated] = useState(false);
  const [ready, setReady] = useState(false);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const createdAt = useRef<Map<string, number>>(new Map());
  const loadedFor = useRef<string | null>(null);
  const wasPending = useRef(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const shouldLoad = activated || onAgentRoute || open;
  const page = assistantPage(pathname);

  useEffect(() => {
    loadedFor.current = null;
    setReady(false);
    setConversations([]);
  }, [userId]);

  useEffect(() => {
    if (!userId || !shouldLoad || loadedFor.current === userId) return;
    loadedFor.current = userId;
    const loaded = loadConversations(userId);
    createdAt.current = new Map(loaded.map((item) => [item.id, item.createdAt]));
    setConversations(loaded);
    setReady(true);
  }, [userId, shouldLoad]);

  useEffect(() => {
    if (!userId || !ready) return;
    const id = thread.conversationId;
    const messages = thread.thread;
    setConversations((current) => {
      if (messages.length === 0) {
        if (!current.some((item) => item.id === id)) return current;
        const next = current.filter((item) => item.id !== id);
        saveConversations(userId, next);
        return next;
      }
      const previous = current.find((item) => item.id === id);
      if (previous && JSON.stringify(previous.messages) === JSON.stringify(messages)) return current;
      const next = upsertConversation(current, {
        id,
        title: "",
        createdAt: createdAt.current.get(id) ?? previous?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        messages,
      });
      const row = next.find((item) => item.id === id);
      if (row) createdAt.current.set(id, row.createdAt);
      saveConversations(userId, next);
      return next;
    });
  }, [userId, ready, thread.conversationId, thread.thread]);

  useEffect(() => {
    if (wasPending.current && !thread.pending && !open) {
      const last = thread.thread.at(-1);
      if (last?.role === "assistant" && !last.error) setUnread(true);
    }
    wasPending.current = thread.pending;
  }, [thread.pending, thread.thread, open]);

  const activate = useCallback(() => setActivated(true), []);

  const close = useCallback(() => {
    setHistoryOpen(false);
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setActivated(true);
    setOpen((current) => {
      if (current) setHistoryOpen(false);
      return !current;
    });
    setUnread(false);
  }, []);

  const toggleHistory = useCallback(() => {
    setActivated(true);
    setHistoryOpen((current) => !current);
  }, []);

  const ask = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;
      activate();
      setHistoryOpen(false);
      setOpen(true);
      setUnread(false);
      void thread.submitQuestion(text);
    },
    [activate, thread.submitQuestion]
  );

  const openAndAsk = useCallback(
    (question: string) => {
      const text = question.trim();
      activate();
      setHistoryOpen(false);
      setOpen(true);
      setUnread(false);
      if (!text) return;
      thread.askFresh(text);
    },
    [activate, thread.askFresh]
  );

  const openFull = useCallback(() => {
    const id = thread.currentConversationId();
    const messages = thread.thread;
    if (userId && messages.length > 0) {
      const next = upsertConversation(conversationsRef.current, {
        id,
        title: "",
        createdAt: createdAt.current.get(id) ?? Date.now(),
        updatedAt: Date.now(),
        messages,
      });
      const row = next.find((item) => item.id === id);
      if (row) createdAt.current.set(id, row.createdAt);
      saveConversations(userId, next);
      setConversations(next);
    }
    setHistoryOpen(false);
    setOpen(false);
    router.push(messages.length > 0 ? `/tradefiz-ai/chat/${id}` : "/tradefiz-ai/chat");
  }, [router, thread, userId]);

  const startNewChat = useCallback(() => {
    thread.beginFresh("");
    setHistoryOpen(false);
  }, [thread.beginFresh]);

  const selectConversation = useCallback(
    (id: string) => {
      const found = conversationsRef.current.find((item) => item.id === id);
      if (!found) return;
      thread.hydrate(found.id, found.messages);
      setHistoryOpen(false);
    },
    [thread.hydrate]
  );

  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  const value = useMemo<AssistantValue>(
    () => ({
      ...thread,
      ready,
      conversations,
      grouped,
      open,
      historyOpen,
      unread,
      pageLabel: page.label,
      prompts: page.prompts,
      toggle,
      close,
      toggleHistory,
      ask,
      openAndAsk,
      openFull,
      startNewChat,
      selectConversation,
    }),
    [
      thread,
      ready,
      conversations,
      grouped,
      open,
      historyOpen,
      unread,
      page.label,
      page.prompts,
      toggle,
      close,
      toggleHistory,
      ask,
      openAndAsk,
      openFull,
      startNewChat,
      selectConversation,
    ]
  );

  return <TradeFixAssistantContext.Provider value={value}>{children}</TradeFixAssistantContext.Provider>;
}

export function useTradeFixAssistant() {
  const value = useContext(TradeFixAssistantContext);
  if (!value) throw new Error("useTradeFixAssistant must be used within TradeFixAssistantProvider");
  return value;
}

export function useTradeFixAssistantOptional() {
  return useContext(TradeFixAssistantContext);
}
