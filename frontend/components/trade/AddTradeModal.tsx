"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Cable, CheckCircle2, FileSpreadsheet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Resolver, useForm } from "react-hook-form";
import { useDropzone } from "react-dropzone";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { AssetSelector } from "@/components/trade/AssetSelector";
import { DateTimeFields, PriceInputs } from "@/components/trade/DateTimePicker";
import { DirectionSelector, TradeStatusSelector } from "@/components/trade/DirectionSelector";
import { NotesEditor } from "@/components/trade/NotesEditor";
import { ScreenshotUploader, Shot } from "@/components/trade/ScreenshotUploader";
import {
  AddTradeFormValues,
  addTradeSchema,
  buildNotes,
  combineDateTime,
  defaultAddTradeValues,
} from "@/components/trade/schema";
import { MistakeSelector, EmotionSelector, PositiveSelector, StrategySelector } from "@/components/trade/StrategySelector";
import { SymbolSearch } from "@/components/trade/SymbolSearch";
import { TradeFooter } from "@/components/trade/TradeFooter";
import { TradeTabs } from "@/components/trade/TradeTabs";
import { Section } from "@/components/trade/ui";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useCreateTrade, useImportCsv, useUploadTradeScreenshot } from "@/lib/hooks/useTrades";
import { useUpsertMoodCheckin } from "@/lib/hooks/useMood";
import { TradeInput } from "@/lib/types";

const DRAFT_KEY = "tradefix_add_trade_draft";

export function AddTradeModal() {
  const { user } = useAuth();
  const { activeAccount } = useAccountPrefs();
  const { open, closeModal, tab } = useAddTradeModal();
  const createTrade = useCreateTrade();
  const uploadShot = useUploadTradeScreenshot();
  const [shots, setShots] = useState<Shot[]>([]);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountFee = Math.abs(Number(activeAccount?.default_fee_per_trade ?? 0));
  const userFee =
    user?.default_fee != null && Number.isFinite(Number(user.default_fee))
      ? Math.abs(Number(user.default_fee))
      : null;
  const defaultFee = userFee ?? accountFee;
  const tradeDefaults = useMemo(
    () => ({
      defaultFee,
      defaultSymbol: user?.default_symbol ?? "",
      defaultQuantity: user?.default_quantity != null ? Number(user.default_quantity) : null,
      defaultLeverage: user?.default_forex_leverage != null ? Number(user.default_forex_leverage) : null,
      defaultStrategies: user?.default_strategies ?? [],
    }),
    [
      defaultFee,
      user?.default_symbol,
      user?.default_quantity,
      user?.default_forex_leverage,
      user?.default_strategies,
    ]
  );

  const form = useForm<AddTradeFormValues>({
    resolver: zodResolver(addTradeSchema) as Resolver<AddTradeFormValues>,
    defaultValues: defaultAddTradeValues(tradeDefaults),
    mode: "onSubmit",
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = form;

  const values = watch();

  useEffect(() => {
    if (!open) return;
    const template = user?.journal_template?.trim() || "";
    const defaults = defaultAddTradeValues(tradeDefaults);
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AddTradeFormValues>;
        reset({
          ...defaults,
          ...parsed,
          notes: parsed.notes || template || "",
          fees: parsed.fees ?? defaults.fees,
          symbol: parsed.symbol || defaults.symbol,
          quantity: parsed.quantity ?? defaults.quantity,
          leverage: parsed.leverage ?? defaults.leverage,
          strategies: parsed.strategies?.length ? parsed.strategies : defaults.strategies,
          emotions: parsed.emotions ?? [],
          mistakes: parsed.mistakes ?? [],
          wentWell: parsed.wentWell ?? [],
          risk_amount: parsed.risk_amount ?? null,
          plan_compliance: parsed.plan_compliance ?? null,
        });
      } else {
        reset({ ...defaults, notes: template });
      }
    } catch {
      reset({ ...defaults, notes: template });
    }
    setShots([]);
    setSuccess(false);
    setSaveError(null);
  }, [open, reset, user?.journal_template, tradeDefaults]);

  useEffect(() => {
    if (!open || tab !== "manual") return;
    const id = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    }, 800);
    return () => window.clearTimeout(id);
  }, [values, open, tab]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onSave = handleSubmit(async (data) => {
    setSaveError(null);
    const opened_at = combineDateTime(data.entryDate, data.entryTime);
    if (!opened_at) {
      setSaveError("Invalid entry date/time");
      return;
    }

    const closed_at = data.status === "closed" ? combineDateTime(data.exitDate, data.exitTime) : null;

    const notes = buildNotes(data);

    const setupTags = data.strategies;
    const payload: TradeInput = {
      symbol: data.symbol.trim().toUpperCase(),
      asset_type: data.asset_type,
      side: data.side,
      quantity: Number(data.quantity),
      entry_price: Number(data.entry_price),
      exit_price: data.status === "closed" ? Number(data.exit_price) : null,
      opened_at,
      closed_at,
      fees: Number(data.fees ?? defaultFee),
      risk_amount: data.risk_amount != null ? Number(data.risk_amount) : null,
      plan_compliance: data.plan_compliance != null ? Number(data.plan_compliance) : null,
      setup_tag: setupTags[0] ?? null,
      setup_tags: setupTags,
      emotion_tags: data.emotions,
      mood: null,
      notes: notes || null,
      rules_broken: data.mistakes,
      status: data.status,
      account_id: activeAccount?.id,
    };

    setSaving(true);
    try {
      const created = await createTrade.mutateAsync(payload);
      for (const shot of shots.slice(0, 5)) {
        try {
          await uploadShot.mutateAsync({ id: created.id, file: shot.file });
        } catch {
          // Trade is saved; surface screenshot failures without blocking success UX
          setSaveError((prev) => prev ?? "Trade saved, but some screenshots failed to upload");
        }
      }
      localStorage.removeItem(DRAFT_KEY);
      setSuccess(true);
      window.setTimeout(() => {
        closeModal();
        setSuccess(false);
      }, 900);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save trade");
    } finally {
      setSaving(false);
    }
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close modal backdrop" className="absolute inset-0" onClick={closeModal} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-trade-title"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative flex max-h-[90vh] w-[520px] max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h2 id="add-trade-title" className="font-semibold text-base text-white">
                Add Entry
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-500 transition-colors hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <TradeTabs />

            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-4">
              {tab === "manual" && (
                <div className="space-y-4">
                  <AssetSelector control={control} error={errors.asset_type?.message} />

                  <div className="grid grid-cols-2 gap-3">
                    <SymbolSearch control={control} error={errors.symbol?.message} />
                    <DirectionSelector control={control} />
                  </div>

                  <TradeStatusSelector control={control} />

                  <DateTimeFields control={control} errors={errors} watch={watch} />

                  <PriceInputs register={register} errors={errors} watch={watch} />

                  <Section title="Setup / Strategy">
                    <StrategySelector control={control} />
                  </Section>

                  <Section title="Emotions">
                    <EmotionSelector control={control} />
                  </Section>

                  <Section title="Mistakes">
                    <MistakeSelector control={control} />
                  </Section>

                  <Section title="What Went Well">
                    <PositiveSelector control={control} />
                  </Section>

                  <NotesEditor register={register} watch={watch} />

                  <ScreenshotUploader files={shots} onChange={setShots} max={5} />
                </div>
              )}

              {tab === "journal" && <DailyJournalTab onDone={closeModal} />}
              {tab === "csv" && <CsvTab onDone={closeModal} />}
              {tab === "broker" && <BrokerTab />}
            </div>

            {tab === "manual" && (
              <>
                {saveError && (
                  <div className="border-t border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
                    {saveError}
                  </div>
                )}
                {Object.keys(errors).length > 0 && (
                  <div className="border-t border-amber-500/20 bg-amber-500/10 px-5 py-2 text-xs text-amber-400">
                    Fill required fields: symbol, entry price, qty
                    {watch("status") === "closed" ? ", and exit price" : ""}.
                  </div>
                )}
                <TradeFooter
                  saving={saving || createTrade.isPending || uploadShot.isPending}
                  onSave={() => onSave()}
                  disabled={saving || createTrade.isPending || uploadShot.isPending}
                />
              </>
            )}

            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <p className="font-semibold text-xl text-white">Trade saved</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DailyJournalTab({ onDone }: { onDone: () => void }) {
  const upsert = useUpsertMoodCheckin();
  const [score, setScore] = useState(7);
  const [notes, setNotes] = useState("");

  async function save() {
    await upsert.mutateAsync({
      date: new Date().toISOString().slice(0, 10),
      mood_score: score,
      notes: notes || undefined,
    });
    onDone();
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <BookOpen className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-xl text-white">Daily Journal</h3>
        <p className="mt-1 text-sm text-zinc-500">Quick mood pulse for today.</p>
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">Mood score · {score}/10</p>
        <input
          type="range"
          min={1}
          max={10}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <Textarea
        rows={5}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="How did the session feel? Any lessons?"
        className="border-white/10 bg-zinc-900"
      />
      <Button onClick={save} disabled={upsert.isPending} className="w-full">
        {upsert.isPending ? "Saving…" : "Save Journal Entry"}
      </Button>
    </div>
  );
}

function CsvTab({ onDone }: { onDone: () => void }) {
  const importCsv = useImportCsv();
  const [message, setMessage] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      try {
        const res = await importCsv.mutateAsync(file);
        setMessage(`Imported ${res.imported} trades (${res.skipped_duplicates} duplicates skipped).`);
        if (res.imported > 0) window.setTimeout(onDone, 1200);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Import failed");
      }
    },
    [importCsv, onDone]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] },
    multiple: false,
  });

  return (
    <div className="space-y-5 py-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-xl text-white">Import CSV</h3>
        <p className="mt-1 text-sm text-zinc-500">Drop a broker export — columns are auto-mapped when possible.</p>
      </div>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border border-dashed px-6 py-12 text-center transition ${
          isDragActive ? "border-primary bg-primary/10" : "border-white/20 hover:border-white/40"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-zinc-400">
          {importCsv.isPending ? "Importing…" : "Drop CSV here or click to browse"}
        </p>
      </div>
      {message && <p className="text-sm text-zinc-500">{message}</p>}
    </div>
  );
}

function BrokerTab() {
  return (
    <div className="space-y-5 py-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Cable className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-xl text-white">Connect Broker</h3>
      <p className="text-sm leading-relaxed text-zinc-500">
        Prefer CSV for now, or log trades manually. Connection UI is open — pick a broker when you are ready to wire
        credentials.
      </p>
      <Button variant="secondary">Start connection</Button>
    </div>
  );
}
