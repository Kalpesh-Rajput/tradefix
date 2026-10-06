"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CheckCircle2, FileSpreadsheet, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Control, Resolver, useForm, useFormState, useWatch } from "react-hook-form";
import { useDropzone } from "react-dropzone";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { BrokerConnectPanel } from "@/components/broker/BrokerConnectPanel";
import { DEEP_FIELDS, collectErrorMessages, firstErrorField } from "@/components/trade/formErrors";
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
import { hasDeepEntryData } from "@/components/trade/DeepEntryPanel";
import { Shot } from "@/components/trade/ScreenshotUploader";
import { TradeEntryForm } from "@/components/trade/TradeEntryForm";
import { TradeFooter } from "@/components/trade/TradeFooter";
import { useAddTradeModal } from "@/components/trade/useAddTradeModal";
import { useLiveTradeCalc } from "@/components/trade/useLiveTradeCalc";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { getInstrument, symbolsFor } from "@/lib/instruments/catalog";
import {
  useCreateTrade,
  useDeleteTradeScreenshot,
  useImportCsv,
  useTrade,
  useUpdateTrade,
  useUploadTradeScreenshot,
} from "@/lib/hooks/useTrades";
import { useMasters, usePrecheckLists } from "@/lib/hooks/useMasters";
import { usePlaybooks } from "@/lib/hooks/usePlaybooks";
import { playbookMatchingName } from "@/lib/playbooks/stats";
import { useUpsertMoodCheckin } from "@/lib/hooks/useMood";
import { TradeExecutionInput, TradeInput } from "@/lib/types";

export function AddTradeModal() {
  const { user } = useAuth();
  const { activeAccount, accounts } = useAccountPrefs();
  const { open, closeModal, tab, tradeId, initialBrokerId, initialServer, initialAccountId } = useAddTradeModal();
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const deleteShot = useDeleteTradeScreenshot();
  const { data: editingTrade } = useTrade(tradeId || undefined);
  const uploadShot = useUploadTradeScreenshot();
  const isEditing = Boolean(tradeId);
  const editPending = isEditing && !editingTrade;
  const { data: precheckLists = [] } = usePrecheckLists({ enabled: open });
  const { data: playbooks = [] } = usePlaybooks({ enabled: open });
  useMasters("symbol", { enabled: open });
  const [shots, setShots] = useState<Shot[]>([]);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deepOpen, setDeepOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

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
    [defaultFee, user?.default_symbol, user?.default_quantity, user?.default_forex_leverage, user?.default_strategies]
  );

  const form = useForm<AddTradeFormValues>({
    resolver: zodResolver(addTradeSchema) as Resolver<AddTradeFormValues>,
    defaultValues: defaultAddTradeValues(tradeDefaults),
    mode: "onSubmit",
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    clearErrors,
    formState: { isDirty },
  } = form;

  const assetType = useWatch({ control, name: "asset_type" });
  const symbol = useWatch({ control, name: "symbol" });
  const symbolSuggestions = useMemo(() => symbolsFor(assetType), [assetType]);

  useEffect(() => {
    const inst = getInstrument(assetType, symbol);
    if (!inst) return;
    if (inst.contractSize) setValue("contract_size", inst.contractSize);
    if (inst.lotSize && assetType === "option") setValue("contract_size", inst.lotSize);
    if (assetType === "future") {
      if (inst.tickSize != null) setValue("tick_size", inst.tickSize);
      if (inst.tickValue != null) setValue("tick_value", inst.tickValue);
    }
  }, [assetType, symbol, setValue]);

  function handleSegmentChange(next: AddTradeFormValues["asset_type"]) {
    const current = getValues();
    const patch = applySegmentDefaults(current, next, {
      defaultLeverage: user?.default_forex_leverage != null ? Number(user.default_forex_leverage) : 100,
    });
    Object.entries(patch).forEach(([key, value]) => {
      setValue(key as keyof AddTradeFormValues, value as never, { shouldValidate: false, shouldDirty: true });
    });
    clearErrors();
  }

  const blankForm = useCallback(() => {
    const defaults = defaultAddTradeValues(tradeDefaults);
    const template = user?.journal_template?.trim() || "";
    return {
      ...defaults,
      notes: template,
      account_id: initialAccountId || activeAccount?.id || null,
    };
  }, [tradeDefaults, user?.journal_template, initialAccountId, activeAccount?.id]);

  useEffect(() => {
    if (open) return;
    reset(blankForm());
    clearErrors();
    setShots([]);
    setSuccess(false);
    setSaveError(null);
    setConfirmDiscard(false);
    setDeepOpen(false);
  }, [open, reset, clearErrors, blankForm]);

  useEffect(() => {
    if (!open) return;
    setShots([]);
    setSuccess(false);
    setSaveError(null);
    setConfirmDiscard(false);
    setDeepOpen(false);
    if (!tradeId) reset(blankForm());
    // Reset only when the modal opens or the target trade changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tradeId, initialAccountId]);

  useEffect(() => {
    if (!open || !tradeId || !editingTrade) return;
    const next = mapTradeToForm(editingTrade);
    reset({ ...next, account_id: editingTrade.account_id });
    setDeepOpen(hasDeepEntryData(next, editingTrade.screenshot_urls?.length ?? 0));
    setShots(
      (editingTrade.screenshot_urls ?? []).map((url) => ({
        id: url,
        kind: "saved" as const,
        url,
        preview: url,
      }))
    );
  }, [open, tradeId, editingTrade, reset]);

  const requestClose = useCallback(() => {
    if (tab === "manual" && isDirty) {
      setConfirmDiscard(true);
      return;
    }
    closeModal();
  }, [tab, isDirty, closeModal]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (confirmDiscard) {
        setConfirmDiscard(false);
        return;
      }
      requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirmDiscard, requestClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function focusField(key: string | null) {
    if (!key || !bodyRef.current) return;
    const root = bodyRef.current.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`);
    if (!root) return;
    root.scrollIntoView({ block: "center", behavior: "smooth" });
    const target = root.querySelector<HTMLElement>(
      "button[aria-haspopup], button[aria-pressed], input:not([type='hidden']), textarea, select"
    );
    target?.focus();
  }

  const onSave = handleSubmit(
    async (data) => {
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
      const selectedPlaybook =
        playbooks.find((playbook) => playbook.id === data.playbook_id) ?? playbookMatchingName(playbooks, data.strategies[0]);
      const setupTags = selectedPlaybook
        ? [selectedPlaybook.name, ...data.strategies.filter((tag) => tag.toLowerCase() !== selectedPlaybook.name.toLowerCase())]
        : data.strategies;
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
        mood: data.mood.length ? data.mood.join(", ") : null,
        notes: notes || null,
        rules_broken: data.mistakes,
        status: snapshot.status,
        account_id: data.account_id || initialAccountId || activeAccount?.id,
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
        strategy_name: setupTags[0] ?? selectedPlaybook?.name ?? null,
        playbook_id: selectedPlaybook?.id ?? (data.playbook_id || null),
        precheck_list_id: data.precheck_list_id || null,
        extra: {
          went_well: data.wentWell,
          moods: data.mood,
          display_status: snapshot.displayStatus,
        },
        executions,
      };

      setSaving(true);
      try {
        const saved =
          isEditing && tradeId ? await updateTrade.mutateAsync({ id: tradeId, data: payload }) : await createTrade.mutateAsync(payload);
        for (const shot of shots) {
          if (shot.kind !== "new") continue;
          try {
            await uploadShot.mutateAsync({ id: saved.id, file: shot.file });
          } catch {
            setSaveError((prev) => prev ?? "Trade saved, but some screenshots failed to upload");
          }
        }
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
    },
    (formErrors) => {
      const key = firstErrorField(formErrors);
      if (key && DEEP_FIELDS.has(key)) setDeepOpen(true);
      window.setTimeout(() => focusField(key), key && DEEP_FIELDS.has(key) ? 240 : 50);
    }
  );

  async function deleteSavedShot(url: string) {
    if (!tradeId) return;
    const previous = shots;
    setShots((current) => current.filter((shot) => shot.kind !== "saved" || shot.url !== url));
    try {
      await deleteShot.mutateAsync({ id: tradeId, url });
    } catch (err) {
      setShots(previous);
      setSaveError(err instanceof Error ? err.message : "Could not remove screenshot");
    }
  }

  const busy = saving || createTrade.isPending || updateTrade.isPending || uploadShot.isPending;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(20,21,26,0.38)] p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close modal backdrop" className="absolute inset-0" onClick={requestClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-trade-title"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative flex max-h-[min(92vh,920px)] w-[min(1200px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_64px_rgba(20,21,26,0.16)]"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <h2 id="add-trade-title" className="text-base font-semibold leading-6 text-[var(--color-text-primary)]">
                  {tab === "journal" ? "Daily Journal" : tab === "csv" ? "Import CSV" : tab === "broker" ? "Connect broker" : isEditing ? "Edit Trade" : "Add Trade"}
                </h2>
                {tab === "manual" && !editPending ? <TradeStatusLine control={control} /> : null}
                {tab === "manual" && editPending ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Loading trade</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {tab === "manual" ? <FavouriteButton control={control} setFavourite={(next) => setValue("is_favourite", next, { shouldDirty: true })} /> : null}
                <button
                  type="button"
                  onClick={requestClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div ref={bodyRef} className="min-h-0 overflow-y-auto px-5 py-4">
              {tab === "manual" && editPending ? (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-10 animate-pulse rounded-[10px] bg-[var(--color-surface-secondary)]" />
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }, (_, index) => (
                      <div key={index} className="h-14 animate-pulse rounded-[10px] bg-[var(--color-surface-secondary)]" />
                    ))}
                  </div>
                </div>
              ) : null}
              {tab === "manual" && !editPending ? (
                <TradeEntryForm
                  form={form}
                  accounts={accounts}
                  precheckLists={precheckLists}
                  playbooks={playbooks}
                  symbolSuggestions={symbolSuggestions}
                  onSegmentChange={handleSegmentChange}
                  shots={shots}
                  onShotsChange={setShots}
                  onDeleteSaved={isEditing ? deleteSavedShot : undefined}
                  deepOpen={deepOpen}
                  onDeepOpenChange={setDeepOpen}
                />
              ) : null}
              {tab === "journal" && <DailyJournalTab onDone={closeModal} />}
              {tab === "csv" && <CsvTab onDone={closeModal} />}
              {tab === "broker" && (
                <BrokerTab initialBrokerId={initialBrokerId} initialServer={initialServer} journalAccountId={initialAccountId} />
              )}
            </div>

            {tab === "manual" && (
              <TradeFooterBar control={control} saveError={saveError} saving={busy || editPending} onCancel={requestClose} onSave={() => onSave()} />
            )}

            {confirmDiscard && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-text-primary)]/25 p-6">
                <div
                  role="alertdialog"
                  aria-labelledby="discard-trade-title"
                  aria-describedby="discard-trade-copy"
                  className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-dropdown)]"
                >
                  <h3 id="discard-trade-title" className="text-base font-semibold text-[var(--color-text-primary)]">
                    Discard this trade?
                  </h3>
                  <p id="discard-trade-copy" className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    Closing will lose the entries you have not saved.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setConfirmDiscard(false)}>
                      Keep editing
                    </Button>
                    <Button type="button" variant="danger" onClick={closeModal}>
                      Discard
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--color-surface)]/85 backdrop-blur-sm"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <p className="text-xl font-semibold text-[var(--color-text-primary)]">{isEditing ? "Trade updated" : "Trade saved"}</p>
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

function TradeStatusLine({ control }: { control: Control<AddTradeFormValues> }) {
  const { calc } = useLiveTradeCalc(control);
  const label =
    calc.displayStatus === "closed" ? "Closed" : calc.displayStatus === "partially_closed" ? "Partially closed" : "Open position";
  return <p className="mt-0.5 text-[13px] font-medium text-[var(--color-text-secondary)]">{label}</p>;
}

function FavouriteButton({
  control,
  setFavourite,
}: {
  control: Control<AddTradeFormValues>;
  setFavourite: (next: boolean) => void;
}) {
  const favourite = useWatch({ control, name: "is_favourite" });
  return (
    <button
      type="button"
      onClick={() => setFavourite(!favourite)}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-warning)]"
      aria-label="Mark favourite"
      aria-pressed={Boolean(favourite)}
    >
      <Star className={`h-4 w-4 ${favourite ? "fill-[var(--color-warning)] text-[var(--color-warning)]" : ""}`} />
    </button>
  );
}

function TradeFooterBar({
  control,
  saveError,
  saving,
  onCancel,
  onSave,
}: {
  control: Control<AddTradeFormValues>;
  saveError: string | null;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { errors } = useFormState({ control });
  const messages = collectErrorMessages(errors);
  const validation = messages.length ? `${messages[0]}${messages.length > 1 ? ` · ${messages.length - 1} more` : ""}` : null;
  return (
    <TradeFooter saving={saving} onCancel={onCancel} onSave={onSave} disabled={saving} message={saveError || validation} />
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
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Daily Journal</h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Quick mood pulse for today.</p>
      </div>
      <div className="shrink-0">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">Mood score · {score}/10</p>
        <input
          type="range"
          min={1}
          max={10}
          value={score}
          onChange={(event) => setScore(Number(event.target.value))}
          className="w-full accent-primary"
        />
      </div>
      <Textarea
        rows={5}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="How did the session feel? Any lessons?"
        className="min-h-[140px] flex-1 border-[var(--color-border)] bg-[var(--color-surface)]"
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
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">Import CSV</h3>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Drop a broker export — columns are auto-mapped when possible.</p>
      </div>
      <div
        {...getRootProps()}
        className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition ${
          isDragActive ? "border-primary bg-primary/10" : "border-[var(--color-border)] hover:border-primary/40"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {importCsv.isPending ? "Importing…" : "Drop CSV here or click to browse"}
        </p>
      </div>
      {message && <p className="shrink-0 text-sm text-[var(--color-text-muted)]">{message}</p>}
    </div>
  );
}

function BrokerTab({
  initialBrokerId,
  initialServer,
  journalAccountId,
}: {
  initialBrokerId?: string | null;
  initialServer?: string | null;
  journalAccountId?: string | null;
}) {
  return (
    <div className="min-h-full py-1">
      <BrokerConnectPanel
        compact
        initialBrokerId={initialBrokerId}
        initialServer={initialServer}
        journalAccountId={journalAccountId}
      />
    </div>
  );
}
