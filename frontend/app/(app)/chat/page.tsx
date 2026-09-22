"use client";

import { Suspense } from "react";

import { ChatWorkspace } from "@/components/ai/ChatWorkspace";
import { AiMark } from "@/components/ai/AiMark";

function ChatFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-background)]">
      <AiMark size={36} pulse />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatFallback />}>
      <ChatWorkspace />
    </Suspense>
  );
}
