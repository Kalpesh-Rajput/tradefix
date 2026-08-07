"use client";

import clsx from "clsx";
import { ArrowLeft, ImagePlus, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { ChipGroup } from "@/components/trade/ui";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { resolveEmotionCatalog } from "@/lib/emotions";
import {
  useDeleteTrade,
  useDeleteTradeScreenshot,
  useTrade,
  useUpdateTrade,
  useUploadTradeScreenshot,
} from "@/lib/hooks/useTrades";
import { mediaUrl } from "@/lib/media";
import { resolveMistakeCatalog, resolveStrategyCatalog } from "@/lib/tradingDefaults";

const MAX_SHOTS = 5;

const HEALTH_DIMS: { key: ScoreKey; label: string }[] = [
  { key: "score_preparation", label: "Preparation" },
  { key: "score_risk", label: "Risk" },
  { key: "score_entry", label: "Entry" },
  { key: "score_exit", label: "Exit" },
  { key: "score_discipline", label: "Discipline" },
  { key: "score_psychology", label: "Psychology" },
];

type ScoreKey =
  | "score_preparation"
  | "score_risk"
  | "score_entry"
  | "score_exit"
  | "score_discipline"
  | "score_psychology";

function fmtPnl(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function fmtR(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}R`;
}

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { displayPnl } = useAccountPrefs();
  const toast = useToast();

  const { data: trade, isLoading, isError } = useTrade(params.id);
  const updateTrade = useUpdateTrade();
  const deleteTrade = useDeleteTrade();
  const uploadShot = useUploadTradeScreenshot();
  const deleteShot = useDeleteTradeScreenshot();

  const [notes, setNotes] = useState("");
  const [planCompliance, setPlanCompliance] = useState(5);
  const [setupTags, setSetupTags] = useState<string[]>([]);
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    score_preparation: 5,
    score_risk: 5,
    score_entry: 5,
    score_exit: 5,
    score_discipline: 5,
    score_psychology: 5,
  });
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const strategies = useMemo(() => resolveStrategyCatalog(user), [user]);
  const emotions = useMemo(() => resolveEmotionCatalog(user), [user]);
  const mistakeOptions = useMemo(() => resolveMistakeCatalog(user), [user]);

  useEffect(() => {
    if (!trade) return;
    setNotes(trade.notes ?? "");
    setPlanCompliance(trade.plan_compliance ?? 5);
    setSetupTags(trade.setup_tags?.length ? trade.setup_tags : trade.setup_tag ? [trade.setup_tag] : []);
    setEmotionTags(trade.emotion_tags ?? []);
    setMistakes(trade.rules_broken ?? []);
    setScores({
      score_preparation: trade.score_preparation ?? 5,
      score_risk: trade.score_risk ?? 5,
      score_entry: trade.score_entry ?? 5,
      score_exit: trade.score_exit ?? 5,
      score_discipline: trade.score_discipline ?? 5,
      score_psychology: trade.score_psychology ?? 5,
    });
  }, [trade]);

  const shots = trade?.screenshot_urls ?? [];
  const canUpload = shots.length < MAX_SHOTS;

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!trade || !accepted.length) return;
      const room = MAX_SHOTS - shots.length;
      const files = accepted.slice(0, room);
      for (const file of files) {
        try {
          setUploadPct(0);
          await uploadShot.mutateAsync({
            id: trade.id,
            file,
            onProgress: setUploadPct,
          });
        } catch (err) {
          toast.error("Upload failed", err instanceof Error ? err.message : undefined);
        } finally {
          setUploadPct(null);
        }
      }
      if (accepted.length > room) {
        toast.info(`Maximum ${MAX_SHOTS} screenshots`);
      }
    },
    [trade, shots.length, uploadShot, toast]
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: { "image/png": [], "image/jpeg": [], "image/webp": [] },
    multiple: true,
    disabled: !canUpload || uploadShot.isPending,
    noClick: true,
  });

  async function handleDeleteShot(url: string) {
    if (!trade) return;
    try {
      await deleteShot.mutateAsync({ id: trade.id, url });
      toast.success("Screenshot removed");
    } catch (err) {
      toast.error("Could not delete screenshot", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleSave() {
    if (!trade) return;
    try {
      await updateTrade.mutateAsync({
        id: trade.id,
        data: {
          notes: notes.trim() || null,
          plan_compliance: planCompliance,
          setup_tags: setupTags,
          setup_tag: setupTags[0] ?? null,
          emotion_tags: emotionTags,
          rules_broken: mistakes,
          ...scores,
        },
      });
      toast.success("Trade story saved");
    } catch (err) {
      toast.error("Could not save trade", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleDelete() {
    if (!trade) return;
    if (!confirm("Delete this trade?")) return;
    try {
      await deleteTrade.mutateAsync(trade.id);
      toast.success("Trade deleted");
      router.push("/trades");
    } catch (err) {
      toast.error("Could not delete trade", err instanceof Error ? err.message : undefined);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !trade) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-zinc-400">Trade not found.</p>
        <Link href="/trades" className="mt-3 inline-flex text-sm text-primary hover:underline">
          Back to trades
        </Link>
      </div>
    );
  }

  const pnl = displayPnl(trade.pnl, trade.fees);
  const pnlColor = pnl == null ? "text-zinc-400" : pnl >= 0 ? "text-primary" : "text-destructive";

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/trades"
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Trades
        </Link>
        <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteTrade.isPending}>
          Delete
        </Button>
      </div>

      {/* Header */}
      <header className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{trade.symbol}</h1>
            <p className="mt-1 text-sm capitalize text-zinc-500">
              {trade.side} · {trade.asset_type} · {trade.status}
            </p>
          </div>
          <div className="text-right">
            <p className={clsx("font-mono text-2xl font-semibold", pnlColor)}>{fmtPnl(pnl)}</p>
            <p className="mt-0.5 font-mono text-sm text-zinc-400">{fmtR(trade.r_multiple)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Execution" value={trade.execution_score != null ? `${trade.execution_score}` : "—"} />
          <Metric
            label="Health"
            value={trade.health_score != null ? trade.health_score.toFixed(1) : "—"}
          />
          <Metric label="Qty" value={String(trade.quantity)} />
          <Metric
            label="Risk"
            value={trade.risk_amount != null ? trade.risk_amount.toFixed(2) : "—"}
          />
        </div>
        {trade.auto_flags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {trade.auto_flags.map((flag) => (
              <span
                key={flag}
                className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400"
              >
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Screenshots FIRST */}
      <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5" {...getRootProps()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Screenshots</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {shots.length}/{MAX_SHOTS} · PNG, JPG, WEBP
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canUpload || uploadShot.isPending}
            onClick={open}
          >
            {uploadShot.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {uploadPct != null ? `${uploadPct}%` : "Uploading…"}
              </>
            ) : (
              <>
                <ImagePlus className="h-3.5 w-3.5" />
                Add
              </>
            )}
          </Button>
          <input {...getInputProps()} />
        </div>

        {shots.length === 0 ? (
          <button
            type="button"
            onClick={open}
            disabled={!canUpload}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-10 text-zinc-500 transition hover:border-white/30 hover:text-zinc-300"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Drop charts here or click to browse</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shots.map((url) => {
              const src = mediaUrl(url);
              return (
                <div key={url} className="group relative overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src || undefined} alt="Trade screenshot" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeleteShot(url)}
                    disabled={deleteShot.isPending}
                    className="absolute right-1.5 top-1.5 rounded bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete screenshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <h2 className="mb-2 text-sm font-semibold text-white">Notes</h2>
        <Textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened? What will you repeat or avoid?"
          className="border-white/10 bg-zinc-900"
        />
      </section>

      {/* Plan compliance */}
      <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Plan compliance</h2>
          <span className="font-mono text-sm text-primary">{planCompliance}/10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={planCompliance}
          onChange={(e) => setPlanCompliance(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </section>

      {/* Tags */}
      <section className="space-y-5 rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-white">Setup tags</h2>
          <ChipGroup options={strategies} value={setupTags} onChange={setSetupTags} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-white">Emotion tags</h2>
          <ChipGroup options={emotions} value={emotionTags} onChange={setEmotionTags} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-white">Mistakes</h2>
          <ChipGroup options={mistakeOptions} value={mistakes} onChange={setMistakes} tone="danger" />
        </div>
      </section>

      {/* Health score dimensions */}
      <section className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Health score</h2>
        <div className="space-y-4">
          {HEALTH_DIMS.map(({ key, label }) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs text-zinc-400">{label}</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={scores[key]}
                    onChange={(e) => {
                      const n = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                      setScores((s) => ({ ...s, [key]: n }));
                    }}
                    className="h-8 w-14 border-white/10 bg-zinc-900 px-2 py-1 text-center font-mono text-xs"
                  />
                  <span className="text-[10px] text-zinc-600">/10</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={scores[key]}
                onChange={(e) => setScores((s) => ({ ...s, [key]: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end gap-3 pb-8">
        <Button variant="ghost" onClick={() => router.push("/trades")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={updateTrade.isPending}>
          {updateTrade.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save story"
          )}
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-white">{value}</p>
    </div>
  );
}
