"use client";

import { TradeFizAIComposer } from "@/components/ai/TradeFizAIComposer";
import { useJournalAi } from "@/components/ai/panel/JournalAiContext";

export function TradeFixAIInput() {
  const { question, setQuestion, pending, focusTick, ask, stopReply } = useJournalAi();

  return (
    <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <TradeFizAIComposer
        variant="compact"
        value={question}
        onChange={setQuestion}
        onSubmit={() => ask(question)}
        onStop={stopReply}
        loading={pending}
        focusTick={focusTick}
      />
    </div>
  );
}
