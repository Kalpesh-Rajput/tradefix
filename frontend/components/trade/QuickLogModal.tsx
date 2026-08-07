"use client";

import { Mic, MicOff, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import {
  useTrade,
  useUpdateTrade,
  useUploadTradeVoice,
} from "@/lib/hooks/useTrades";

export function QuickLogModal({
  open,
  tradeId,
  onClose,
}: {
  open: boolean;
  tradeId: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { data: trade, isLoading } = useTrade(tradeId || undefined);
  const update = useUpdateTrade();
  const uploadVoice = useUploadTradeVoice();

  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open || !trade) return;
    setNotes(trade.notes || "");
    setTags([...(trade.setup_tags || []), trade.setup_tag].filter(Boolean).join(", "));
  }, [open, trade]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!tradeId || !chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `quick-log-${Date.now()}.webm`, { type: "audio/webm" });
        try {
          await uploadVoice.mutateAsync({ id: tradeId, file });
          toast.success("Voice note attached");
        } catch (err) {
          toast.error("Voice upload failed", err instanceof Error ? err.message : undefined);
        }
      };
      mediaRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone unavailable");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tradeId) {
      toast.error("No closed trade to update");
      return;
    }
    const setupTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await update.mutateAsync({
        id: tradeId,
        data: {
          notes: notes.trim() || null,
          setup_tags: setupTags,
          setup_tag: setupTags[0] || null,
        },
      });
      toast.success("Quick log saved");
      onClose();
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : undefined);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="quick-log-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="quick-log-title" className="text-lg font-semibold text-white">
              Quick Log
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {isLoading
                ? "Loading trade…"
                : trade
                  ? `${trade.symbol} · last closed trade`
                  : tradeId
                    ? "Trade not found"
                    : "Pick a closed trade first"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
              Notes
            </label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What mattered on this trade?"
              className="border-white/10 bg-black"
              disabled={!tradeId || isLoading}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
              Tags
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Breakout, ORB (comma-separated)"
              className="border-white/10 bg-black"
              disabled={!tradeId || isLoading}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!tradeId || uploadVoice.isPending}
              onClick={() => (recording ? stopRecording() : startRecording())}
            >
              {recording ? (
                <>
                  <MicOff className="h-3.5 w-3.5" /> Stop
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" /> Voice
                </>
              )}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!tradeId || update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
