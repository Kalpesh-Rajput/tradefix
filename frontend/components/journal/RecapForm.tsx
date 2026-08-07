"use client";

import clsx from "clsx";
import { ImagePlus, Loader2, Trash2, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { mediaUrl } from "@/lib/media";
import { resolveMistakeCatalog } from "@/lib/tradingDefaults";
import type { DailyRecap, DayMood, DayPnlSummary } from "@/lib/types";

const MOODS: { id: DayMood; emoji: string; label: string }[] = [
  { id: "good", emoji: "☀️", label: "Good day" },
  { id: "mixed", emoji: "⛅", label: "Mixed" },
  { id: "tough", emoji: "🌧️", label: "Tough day" },
];

const MAX_SHOTS = 5;

type PendingShot = { id: string; file: File; preview: string };

export type RecapFormValues = {
  day_mood: DayMood | null;
  work_on: string[];
  best_decision: string;
  reflection: string;
  pnl_override: boolean;
  gross_pnl: number;
  fees: number;
  net_pnl: number;
};

function moneyColor(n: number) {
  if (n > 0) return "text-sky-300";
  if (n < 0) return "text-rose-300";
  return "text-zinc-300";
}

export function RecapForm({
  dateLabel,
  recapNumber,
  existing,
  dayPnl,
  saving,
  onSave,
  onDelete,
  onUploadScreenshot,
  onDeleteScreenshot,
}: {
  dateLabel: string;
  recapNumber: number;
  existing: DailyRecap | null;
  dayPnl: DayPnlSummary | undefined;
  saving?: boolean;
  onSave: (values: RecapFormValues, pendingShots: File[]) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUploadScreenshot?: (file: File, onProgress?: (p: number) => void) => Promise<void>;
  onDeleteScreenshot?: (url: string) => Promise<void>;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { formatMoney } = useAccountPrefs();
  const tags = resolveMistakeCatalog(user);

  const computedGross = dayPnl?.gross_pnl ?? existing?.computed_gross_pnl ?? 0;
  const computedFees = dayPnl?.fees ?? existing?.computed_fees ?? 0;
  const computedNet = dayPnl?.net_pnl ?? existing?.computed_net_pnl ?? 0;

  const [dayMood, setDayMood] = useState<DayMood | null>(existing?.day_mood ?? null);
  const [workOn, setWorkOn] = useState<string[]>(existing?.work_on ?? []);
  const [bestDecision, setBestDecision] = useState(existing?.best_decision ?? "");
  const [reflection, setReflection] = useState(existing?.reflection ?? "");
  const [pnlOverride, setPnlOverride] = useState(existing?.pnl_override ?? false);
  const [grossPnl, setGrossPnl] = useState(
    existing?.pnl_override && existing.gross_pnl != null ? existing.gross_pnl : computedGross
  );
  const [fees, setFees] = useState(
    existing?.pnl_override && existing.fees != null ? existing.fees : computedFees
  );
  const [pendingShots, setPendingShots] = useState<PendingShot[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync when switching entries / computed P&L updates (and form not dirty)
  useEffect(() => {
    setDayMood(existing?.day_mood ?? null);
    setWorkOn(existing?.work_on ?? []);
    setBestDecision(existing?.best_decision ?? "");
    setReflection(existing?.reflection ?? "");
    setPnlOverride(existing?.pnl_override ?? false);
    setGrossPnl(
      existing?.pnl_override && existing.gross_pnl != null ? existing.gross_pnl : computedGross
    );
    setFees(existing?.pnl_override && existing.fees != null ? existing.fees : computedFees);
    setPendingShots((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.preview));
      return [];
    });
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, existing?.updated_at]);

  useEffect(() => {
    if (!dirty && !pnlOverride) {
      setGrossPnl(computedGross);
      setFees(computedFees);
    }
  }, [computedGross, computedFees, dirty, pnlOverride]);

  const netPnl = pnlOverride ? Number((grossPnl - fees).toFixed(2)) : computedNet;
  const displayGross = pnlOverride ? grossPnl : computedGross;
  const displayFees = pnlOverride ? fees : computedFees;
  const displayNet = pnlOverride ? netPnl : computedNet;

  const savedUrls = existing?.screenshot_urls ?? [];
  const totalShots = savedUrls.length + pendingShots.length;

  const markDirty = () => setDirty(true);

  const toggleTag = (tag: string) => {
    markDirty();
    setWorkOn((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addFiles = useCallback(
    async (files: File[]) => {
      const room = MAX_SHOTS - totalShots;
      if (room <= 0) {
        toast.error(`Maximum ${MAX_SHOTS} screenshots`);
        return;
      }
      const accepted = files.slice(0, room).filter((f) => {
        const ok = ["image/png", "image/jpeg", "image/webp", "image/jpg"].includes(f.type);
        if (!ok) toast.error("Use PNG, JPG, or WEBP");
        if (f.size > 5 * 1024 * 1024) {
          toast.error("Image must be 5MB or smaller");
          return false;
        }
        return ok;
      });
      if (!accepted.length) return;

      // Existing recap → upload immediately
      if (existing && onUploadScreenshot) {
        setUploading(true);
        try {
          for (const file of accepted) {
            await onUploadScreenshot(file);
          }
          toast.success("Screenshot added");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading(false);
        }
        return;
      }

      // Draft → queue until save
      const next = accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setPendingShots((prev) => [...prev, ...next]);
      markDirty();
    },
    [existing, onUploadScreenshot, toast, totalShots]
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      void addFiles(accepted);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    accept: { "image/png": [], "image/jpeg": [], "image/webp": [] },
    multiple: true,
    noClick: true,
    disabled: uploading || totalShots >= MAX_SHOTS,
  });

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) void addFiles(imgs);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const removePending = (id: string) => {
    setPendingShots((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((s) => s.id !== id);
    });
    markDirty();
  };

  const removeSaved = async (url: string) => {
    if (!onDeleteScreenshot) return;
    try {
      await onDeleteScreenshot(url);
      toast.success("Screenshot removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const handleSave = async () => {
    try {
      await onSave(
        {
          day_mood: dayMood,
          work_on: workOn,
          best_decision: bestDecision,
          reflection: reflection,
          pnl_override: pnlOverride,
          gross_pnl: displayGross,
          fees: displayFees,
          net_pnl: displayNet,
        },
        pendingShots.map((s) => s.file)
      );
      setPendingShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.preview));
        return [];
      });
      setDirty(false);
    } catch {
      // parent toasts
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Delete this recap? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-4 pt-2">
      <header>
        <h2 className="text-[1.875rem] font-semibold leading-tight tracking-tight text-white sm:text-[2rem]">
          Journal
        </h2>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Recap #{recapNumber}
        </p>
        <p className="mt-1.5 text-xl font-semibold tracking-tight text-white">{dateLabel}</p>
      </header>

      {/* P&L Summary */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            P&amp;L Summary
          </h3>
          <button
            type="button"
            onClick={() => {
              markDirty();
              setPnlOverride((v) => {
                if (v) {
                  setGrossPnl(computedGross);
                  setFees(computedFees);
                }
                return !v;
              });
            }}
            className={clsx(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              pnlOverride
                ? "bg-primary/20 text-primary"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            )}
          >
            {pnlOverride ? "Using override" : "Override P&L"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <PnlCard
            label="Gross P&L"
            value={displayGross}
            formatMoney={formatMoney}
            editable={pnlOverride}
            onChange={(n) => {
              markDirty();
              setGrossPnl(n);
            }}
          />
          <PnlCard
            label="Fees"
            value={displayFees}
            formatMoney={formatMoney}
            forceNegative
            editable={pnlOverride}
            onChange={(n) => {
              markDirty();
              setFees(Math.abs(n));
            }}
          />
          <PnlCard label="Net P&L" value={displayNet} formatMoney={formatMoney} />
        </div>
        {!pnlOverride && (dayPnl?.trade_count ?? existing?.trade_count ?? 0) === 0 && (
          <p className="mt-2 text-xs text-zinc-600">No closed trades for this day — totals are $0.</p>
        )}
      </section>

      {/* Mood */}
      <section>
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          How did today go?
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {MOODS.map((m) => {
            const active = dayMood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  markDirty();
                  setDayMood((prev) => (prev === m.id ? null : m.id));
                }}
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-xl border px-3 py-5 transition",
                  active
                    ? "border-white/40 bg-white/[0.06] text-white"
                    : "border-white/[0.08] bg-transparent text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {m.emoji}
                </span>
                <span className="text-sm font-medium">{m.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Work on tags */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            What to work on
          </h3>
          <span className="text-[10px] text-zinc-600">multi-select</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const active = workOn.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={clsx(
                  "rounded-lg border px-3 py-1.5 text-xs transition",
                  active
                    ? "border-white/50 bg-white/[0.08] text-white"
                    : "border-white/[0.08] bg-zinc-900/60 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </section>

      {/* Best decision */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber-400/90">
          <Trophy className="h-3.5 w-3.5" />
          Best decision today
        </h3>
        <Input
          value={bestDecision}
          onChange={(e) => {
            markDirty();
            setBestDecision(e.target.value);
          }}
          placeholder="What was your best call today?"
          maxLength={500}
        />
      </section>

      {/* Reflection */}
      <section>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Reflection
        </h3>
        <Textarea
          value={reflection}
          onChange={(e) => {
            markDirty();
            setReflection(e.target.value);
          }}
          placeholder="What happened today? What would you do differently?"
          rows={5}
          maxLength={5000}
        />
      </section>

      {/* Screenshots */}
      <section {...getRootProps()}>
        <input {...getInputProps()} />
        <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Screenshots {totalShots}/{MAX_SHOTS}
        </h3>
        <button
          type="button"
          disabled={uploading || totalShots >= MAX_SHOTS}
          onClick={() => open()}
          className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-zinc-400 transition hover:border-white/40 hover:text-white disabled:opacity-40"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Add screenshot
        </button>

        {(savedUrls.length > 0 || pendingShots.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {savedUrls.map((url) => {
              const src = mediaUrl(url);
              return (
                <div key={url} className="group relative overflow-hidden rounded-lg border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src || url} alt="Screenshot" className="h-28 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => void removeSaved(url)}
                    className="absolute right-1.5 top-1.5 rounded bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove screenshot"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {pendingShots.map((shot) => (
              <div key={shot.id} className="group relative overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shot.preview} alt={shot.file.name} className="h-28 w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  Pending
                </span>
                <button
                  type="button"
                  onClick={() => removePending(shot.id)}
                  className="absolute right-1.5 top-1.5 rounded bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove screenshot"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer actions */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/[0.06] bg-zinc-950/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            size="lg"
            disabled={saving || uploading}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save recap"
            )}
          </Button>
          {existing && onDelete && (
            <Button
              variant="danger"
              size="lg"
              className="!px-3"
              disabled={deleting || saving}
              onClick={() => void handleDelete()}
              aria-label="Delete recap"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PnlCard({
  label,
  value,
  formatMoney,
  editable,
  forceNegative,
  onChange,
}: {
  label: string;
  value: number;
  formatMoney: (n: number, opts?: { signed?: boolean }) => string;
  editable?: boolean;
  forceNegative?: boolean;
  onChange?: (n: number) => void;
}) {
  const display = forceNegative ? -Math.abs(value) : value;
  if (editable && onChange) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
        <Input
          type="number"
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={clsx("mt-1 !border-0 !bg-transparent !px-0 !py-0 font-mono text-lg", moneyColor(display))}
        />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={clsx("mt-1 font-mono text-lg tabular-nums", moneyColor(display))}>
        {formatMoney(display)}
      </p>
    </div>
  );
}
