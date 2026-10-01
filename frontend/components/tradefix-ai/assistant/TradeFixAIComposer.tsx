"use client";

import { TradeFizAIComposer } from "@/components/ai/TradeFizAIComposer";

import { useTradeFixAssistant } from "./TradeFixAssistantProvider";

export function TradeFixAIComposer() {
  const { question, setQuestion, pending, ask, stopReply } = useTradeFixAssistant();

  return (
    <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <TradeFizAIComposer
        variant="compact"
        value={question}
        onChange={setQuestion}
        onSubmit={() => ask(question)}
        onStop={stopReply}
        loading={pending}
      />
    </div>
  );
}
