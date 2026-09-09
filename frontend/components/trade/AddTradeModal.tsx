"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CheckCircle2, FileSpreadsheet, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, Resolver, useForm } from "react-hook-form";
import { useDropzone } from "react-dropzone";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { AssetSelector } from "@/components/trade/AssetSelector";
import { MasterCombobox } from "@/components/trade/MasterCombobox";
import { NotesEditor } from "@/components/trade/NotesEditor";
import { PartialFillsEditor } from "@/components/trade/PartialFillsEditor";
import { ScreenshotUploader, Shot } from "@/components/trade/ScreenshotUploader";
import { SegmentSpecificFields } from "@/components/trade/SegmentSpecificFields";
import {
  AddTradeFormValues,
  addTradeSchema,
  applySegmentDefaults,
  buildNotes,
  combineDateTime,
  defaultAddTradeValues,
  liveTradeCalc,
  mapTradeToForm,
} from "@/components/trade/schema";
import { EmotionSelector, MistakeSelector, PositiveSelector, StrategySelector } from "@/components/trade/StrategySelector";
import { DirectionSelector } from "@/components/trade/DirectionSelector";
import { TradeFooter } from "@/components/trade/TradeFooter";
import { TradeTabs } from "@/components/trade/TradeTabs";
import { FieldLabel, Section } from "@/components/trade/ui";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { BrokerConnectPanel } from "@/components/broker/BrokerConnectPanel";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { fmtMoney } from "@/lib/format";
import { getInstrument, symbolsFor } from "@/lib/instruments/catalog";
import { useCreateTrade, useImportCsv, useTrade, useUpdateTrade, useUploadTradeScreenshot } from "@/lib/hooks/useTrades";
import { useMasters, usePrecheckLists } from "@/lib/hooks/useMasters";
import { useUpsertMoodCheckin } from "@/lib/hooks/useMood";
import { TradeExecutionInput, TradeInput } from "@/lib/types";

const DRAFT_KEY = "tradefix_add_trade_draft";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/40 disabled:opacity-40";

export function AddTradeModal() {
  const { user } = useAuth();
  const { activeAccount, accounts } = useAccountPrefs();
  const { open, closeModal, tab, tradeId, initialBrokerId } = useAddTradeModal();
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const { data: editingTrade } = useTrade(tradeId || undefined);
  const uploadShot = useUploadTradeScreenshot();
  const isEditing = Boolean(tradeId);
  const { data: precheckLists = [] } = usePrecheckLists({ enabled: open });
  useMasters("symbol", { enabled: open });
  const [shots, setShots] = useState<Shot[]>([]);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const skipDraftSaveRef = useRef(false);

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
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const values = watch();
  const calc = useMemo(() => liveTradeCalc(values), [values]);
  const symbolSuggestions = useMemo(() => symbolsFor(values.asset_type), [values.asset_type]);

  useEffect(() => {
    const inst = getInstrument(values.asset_type, values.symbol);
    if (!inst) return;
    if (inst.contractSize) setValue("contract_size", inst.contractSize);
    if (inst.lotSize && values.asset_type === "option") setValue("contract_size", inst.lotSize);
    if (values.asset_type === "future") {
      if (inst.tickSize != null) setValue("tick_size", inst.tickSize);
      if (inst.tickValue != null) setValue("tick_value", inst.tickValue);
    }
  }, [values.asset_type, values.symbol, setValue]);

  function handleSegmentChange(next: AddTradeFormValues["asset_type"]) {
    const current = getValues();
    const patch = applySegmentDefaults(current, next, {
      defaultLeverage: user?.default_forex_leverage != null ? Number(user.default_forex_leverage) : 100,
    });
    Object.entries(patch).forEach(([key, value]) => {
      setValue(key as keyof AddTradeFormValues, value as never, { shouldValidate: false });
    });
  }

  const blankForm = useCallback(() => {
    const defaults = defaultAddTradeValues(tradeDefaults);
    const template = user?.journal_template?.trim() || "";
    return { ...defaults, notes: template, account_id: activeAccount?.id || null };
  }, [tradeDefaults, user?.journal_template, activeAccount?.id]);

  useEffect(() => {
    if (!open) return;
    skipDraftSaveRef.current = false;
    localStorage.removeItem(DRAFT_KEY);
    setShots([]);
    setSuccess(false);
    setSaveError(null);
    if (!tradeId) reset(blankForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tradeId]);

  useEffect(() => {
    if (!open || !tradeId || !editingTrade) return;
    reset({ ...mapTradeToForm(editingTrade), account_id: editingTrade.account_id });
  }, [open, tradeId, editingTrade, reset]);

  useEffect(() => {
    if (!open || tab !== "manual" || skipDraftSaveRef.current) return;
    const id = window.setTimeout(() => {
      if (skipDraftSaveRef.current) return;
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

    const executions: TradeExecutionInput[] = [
      {
        leg_type: "entry",
        quantity: Number(data.quantity),
        price: Number(data.entry_price),
        executed_at: opened_at,
        condition: data.entry_condition || null,
        sort_order: 0,
      },
    ];
    data.exits.forEach((leg, index) => {
      const at = combineDateTime(leg.date, leg.time) || opened_at;
      executions.push({
        leg_type: "exit",
        quantity: Number(leg.quantity),
        price: Number(leg.price),
        executed_at: at,
        fees: Number(leg.fees || 0),
        condition: leg.condition || data.exit_condition || null,
        sort_order: index + 1,
      });
    });

    const lastExit = data.exits[data.exits.length - 1];
    const closed_at = lastExit ? combineDateTime(lastExit.date, lastExit.time) : null;
    const notes = buildNotes(data);
    const setupTags = data.strategies;
    const snapshot = liveTradeCalc(data);

    const payload: TradeInput = {
      symbol: data.symbol.trim().toUpperCase(),
      asset_type: data.asset_type,
      side: data.side,
      quantity: Number(data.quantity),
      entry_price: Number(data.entry_price),
      exit_price: snapshot.exitPrice,
      sell_quantity: snapshot.sellQuantity || null,
      opened_at,
      closed_at,
      fees: Number(data.fees ?? defaultFee),
      risk_amount: data.risk_amount != null ? Number(data.risk_amount) : snapshot.riskAmount,
      plan_compliance: data.plan_compliance != null ? Number(data.plan_compliance) : null,
      setup_tag: setupTags[0] ?? data.trade_type ?? null,
      setup_tags: setupTags,
      emotion_tags: data.emotions,
      mood: data.mood || null,
      notes: notes || null,
      rules_broken: data.mistakes,
      status: snapshot.status,
      account_id: data.account_id || activeAccount?.id,
      session: data.session || null,
      trade_type: data.trade_type || null,
      option_type: data.option_type || null,
      analysis_timeframe: data.analysis_timeframe || null,
      entry_timeframe: data.entry_timeframe || null,
      stop_loss: data.stop_loss != null ? Number(data.stop_loss) : null,
      entry_condition: data.entry_condition || null,
      exit_condition: data.exit_condition || lastExit?.condition || null,
      leverage:
        (data.asset_type === "forex" || data.asset_type === "crypto") && data.leverage != null
          ? Number(data.leverage)
          : null,
      contract_size: data.contract_size != null ? Number(data.contract_size) : null,
      strike_price: data.asset_type === "option" && data.strike_price != null ? Number(data.strike_price) : null,
      expiry_date: data.asset_type === "option" ? data.expiry_date || data.expiry || null : null,
      tick_size: data.asset_type === "future" && data.tick_size != null ? Number(data.tick_size) : null,
      tick_value: data.asset_type === "future" && data.tick_value != null ? Number(data.tick_value) : null,
      is_favourite: Boolean(data.is_favourite),
      strategy_name: setupTags[0] ?? null,
      precheck_list_id: data.precheck_list_id || null,
      extra: {
        went_well: data.wentWell.join(", "),
        display_status: snapshot.displayStatus,
      },
      executions,
    };

    setSaving(true);
    try {
      const saved = isEditing && tradeId
        ? await updateTrade.mutateAsync({ id: tradeId, data: payload })
        : await createTrade.mutateAsync(payload);
      for (const shot of shots.slice(0, 3)) {
        try {
          await uploadShot.mutateAsync({ id: saved.id, file: shot.file });
        } catch {
          setSaveError((prev) => prev ?? "Trade saved, but some screenshots failed to upload");
        }
      }
      skipDraftSaveRef.current = true;
      localStorage.removeItem(DRAFT_KEY);
      reset(blankForm());
      setShots([]);
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
            className="relative flex h-[min(calc(92vh-2rem),860px)] w-[min(920px,100%)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <h2 id="add-trade-title" className="font-semibold text-base text-white">
                  {isEditing ? "Edit Trade" : "Add Trade"}
                </h2>
                <p className="text-[11px] text-muted">
                  {calc.displayStatus === "closed"
                    ? "Closed"
                    : calc.displayStatus === "partially_closed"
                      ? "Partially closed"
                      : "Open position"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setValue("is_favourite", !values.is_favourite)}
                  className="rounded-lg p-2 text-zinc-500 hover:text-warning"
                  aria-label="Mark favourite"
                >
                  <Star className={`h-4 w-4 ${values.is_favourite ? "fill-warning text-warning" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-zinc-500 transition-colors hover:text-white"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {!isEditing && <TradeTabs />}

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 pb-4">
              {tab === "manual" && (
                <div className="space-y-5">
                  <AssetSelector
                    control={control}
                    error={errors.asset_type?.message}
                    onSegmentChange={handleSegmentChange}
                  />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <FieldLabel>Account</FieldLabel>
                      <select className={inputClass} {...register("account_id")}>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Controller
                      control={control}
                      name="session"
                      render={({ field }) => (
                        <MasterCombobox
                          category="session"
                          label="Session"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="London, NY…"
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="trade_type"
                      render={({ field }) => (
                        <MasterCombobox
                          category="trade_type"
                          label="Trade type"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Intraday, scalping…"
                        />
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Controller
                      control={control}
                      name="symbol"
                      render={({ field }) => (
                        <MasterCombobox
                          category="symbol"
                          label={values.asset_type === "option" ? "Underlying" : "Symbol"}
                          value={field.value || ""}
                          onChange={field.onChange}
                          error={errors.symbol?.message}
                          placeholder={symbolSuggestions[0] || "AAPL"}
                          uppercase
                          suggestions={symbolSuggestions}
                        />
                      )}
                    />
                    <DirectionSelector control={control} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <FieldLabel error={errors.entryDate?.message}>Entry date</FieldLabel>
                      <input type="date" className={inputClass} {...register("entryDate")} />
                    </div>
                    <div>
                      <FieldLabel error={errors.entryTime?.message}>Entry time</FieldLabel>
                      <input type="time" className={`${inputClass} [color-scheme:dark]`} {...register("entryTime")} />
                    </div>
                    <Controller
                      control={control}
                      name="analysis_timeframe"
                      render={({ field }) => (
                        <MasterCombobox
                          category="timeframe"
                          label="Analysis TF"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="1H"
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="entry_timeframe"
                      render={({ field }) => (
                        <MasterCombobox
                          category="timeframe"
                          label="Entry TF"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="5m"
                        />
                      )}
                    />
                  </div>

                  <SegmentSpecificFields
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    calc={calc}
                  />

                  <Controller
                    control={control}
                    name="entry_condition"
                    render={({ field }) => (
                      <MasterCombobox
                        category="entry_condition"
                        label="Entry condition"
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Breakout, FVG…"
                      />
                    )}
                  />

                  <PartialFillsEditor control={control} register={register} watch={watch} errors={errors} calc={calc} />

                  <CalcStrip calc={calc} />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Controller
                      control={control}
                      name="mood"
                      render={({ field }) => (
                        <MasterCombobox
                          category="mood"
                          label="Mood"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Calm, FOMO…"
                        />
                      )}
                    />
                    <div>
                      <FieldLabel>Pre-checklist</FieldLabel>
                      <select className={inputClass} {...register("precheck_list_id")}>
                        <option value="">None</option>
                        {precheckLists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Section title="Strategy">
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
                  <ScreenshotUploader files={shots} onChange={setShots} max={3} />
                </div>
              )}

              {tab === "journal" && <DailyJournalTab onDone={closeModal} />}
              {tab === "csv" && <CsvTab onDone={closeModal} />}
              {tab === "broker" && <BrokerTab initialBrokerId={initialBrokerId} />}
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
                    Fill required fields: symbol, entry price, quantity
                    {values.exits?.length ? ", and complete each exit row" : ""}.
                  </div>
                )}
                <TradeFooter
                  saving={saving || createTrade.isPending || updateTrade.isPending || uploadShot.isPending}
                  onSave={() => onSave()}
                  disabled={saving || createTrade.isPending || updateTrade.isPending || uploadShot.isPending}
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
                    <p className="font-semibold text-xl text-white">{isEditing ? "Trade updated" : "Trade saved"}</p>
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

function CalcStrip({
  calc,
}: {
  calc: ReturnType<typeof liveTradeCalc>;
}) {
  const tone = calc.pnl == null ? "text-zinc-300" : calc.pnl >= 0 ? "text-emerald-400" : "text-red-400";
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 sm:grid-cols-5">
      <MiniStat label="Exit qty" value={calc.sellQuantity ? String(calc.sellQuantity) : "—"} />
      <MiniStat label="Avg exit price" value={calc.exitPrice != null ? calc.exitPrice.toFixed(5) : "—"} />
      <MiniStat
        label="Exit value"
        value={calc.sellQuantity ? fmtMoney(calc.totalSellAmount, { signed: false }) : "$0.00"}
      />
      <MiniStat label="Remaining" value={calc.sellQuantity ? String(calc.remainingQuantity) : String(calc.quantity || "—")} />
      <MiniStat label="Realized P&L" value={calc.pnl == null ? "—" : fmtMoney(calc.pnl)} className={tone} />
    </div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 font-mono text-sm ${className || "text-white"}`}>{value}</p>
    </div>
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
    <div className="flex min-h-full flex-col gap-5 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <BookOpen className="h-5 w-5" />
      </div>
      <div className="shrink-0">
        <h3 className="font-semibold text-xl text-white">Daily Journal</h3>
        <p className="mt-1 text-sm text-zinc-500">Quick mood pulse for today.</p>
      </div>
      <div className="shrink-0">
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
        className="min-h-[140px] flex-1 border-white/10 bg-zinc-900"
      />
      <Button onClick={save} disabled={upsert.isPending} className="w-full shrink-0">
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
    <div className="flex min-h-full flex-col gap-5 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <FileSpreadsheet className="h-5 w-5" />
      </div>
      <div className="shrink-0">
        <h3 className="font-semibold text-xl text-white">Import CSV</h3>
        <p className="mt-1 text-sm text-zinc-500">Drop a broker export — columns are auto-mapped when possible.</p>
      </div>
      <div
        {...getRootProps()}
        className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition ${
          isDragActive ? "border-primary bg-primary/10" : "border-white/20 hover:border-white/40"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-zinc-400">
          {importCsv.isPending ? "Importing…" : "Drop CSV here or click to browse"}
        </p>
      </div>
      {message && <p className="shrink-0 text-sm text-zinc-500">{message}</p>}
    </div>
  );
}

function BrokerTab({ initialBrokerId }: { initialBrokerId?: string | null }) {
  return (
    <div className="min-h-full py-1">
      <BrokerConnectPanel compact initialBrokerId={initialBrokerId} />
    </div>
  );
}
