"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { FeaturePage } from "@/components/ui/FeaturePage";
import { Textarea } from "@/components/ui/Input";
import { useRunAgent } from "@/lib/hooks/useAgents";

export default function ChatPage() {
  const run = useRunAgent();
  const [prompt, setPrompt] = useState("Summarize my recent trading patterns.");
  const [reply, setReply] = useState<string | null>(null);

  async function ask() {
    try {
      const res = await run.mutateAsync("journal_pulse");
      setReply(
        typeof res === "string"
          ? res
          : JSON.stringify(res, null, 2) + (prompt ? `\n\n(Your prompt: ${prompt})` : "")
      );
    } catch (e) {
      setReply(e instanceof Error ? e.message : "Failed to run agent");
    }
  }

  return (
    <FeaturePage title="Max AI" subtitle="Ask TradeFix AI about your journal and performance.">
      <Textarea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="border-white/10 bg-zinc-900"
        placeholder="Ask anything about your trading…"
      />
      <div className="mt-3">
        <Button onClick={ask} disabled={run.isPending || !prompt.trim()}>
          {run.isPending ? "Thinking…" : "Ask Max AI"}
        </Button>
      </div>
      {reply && (
        <pre className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-4 text-xs text-zinc-300">
          {reply}
        </pre>
      )}
    </FeaturePage>
  );
}
