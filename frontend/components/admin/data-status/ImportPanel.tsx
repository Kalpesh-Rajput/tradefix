"use client";

import { useState, type FormEvent } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useImportCandles, type CandleImportResult, type InstrumentStatus } from "@/lib/hooks/useDataStatus";

const FIELD = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary";

export function ImportPanel({ instruments }: { instruments: InstrumentStatus[] }) {
  const importer = useImportCandles();
  const toast = useToast();
  const [symbol, setSymbol] = useState(instruments[0]?.symbol ?? "");
  const [preset, setPreset] = useState("dukascopy");
  const [priceSide, setPriceSide] = useState("bid");
  const [label, setLabel] = useState("");
  const [timezone, setTimezone] = useState("");
  const [timeFormat, setTimeFormat] = useState("");
  const [columns, setColumns] = useState("time,open,high,low,close,volume");
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CandleImportResult | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!symbol || !label.trim() || !file) {
      setError("Choose an instrument, a source label, and a csv or zip file.");
      return;
    }
    const form = new FormData();
    form.set("symbol", symbol);
    form.set("preset", preset);
    form.set("label", label.trim());
    form.set("price_side", priceSide);
    form.set("timezone_name", timezone);
    form.set("time_format", timeFormat);
    form.set("columns", columns);
    form.set("dry_run", dryRun ? "true" : "false");
    form.set("force", force ? "true" : "false");
    form.set("file", file);
    importer.mutate(form, {
      onSuccess: (result) => {
        setSummary(result);
        toast.success(result.dry_run ? "Dry run finished" : result.duplicate ? "That file was already imported" : "Candles imported", result.label);
      },
      onError: (err) => {
        const message = err instanceof ApiError ? err.message : "Try again.";
        setError(message);
        toast.error("Couldn’t import candles", message);
      },
    });
  }

  return (
    <form className="dash-card space-y-3 p-5" onSubmit={onSubmit}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">Import candle file</h2>
        <p className="mt-1 text-xs text-muted">
          Dukascopy and HistData 1-minute files, or a generic layout. This does not download anything. An instrument stays disabled until verify-instrument --stored passes.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Instrument
          <select className={FIELD} value={symbol} onChange={(event) => setSymbol(event.target.value)}>
            {instruments.map((item) => (
              <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted">
          Preset
          <select className={FIELD} value={preset} onChange={(event) => setPreset(event.target.value)}>
            <option value="dukascopy">Dukascopy export (UTC)</option>
            <option value="histdata">HistData 1m (UTC-5, no DST)</option>
            <option value="generic">Generic columns</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          Price side
          <select className={FIELD} value={priceSide} onChange={(event) => setPriceSide(event.target.value)}>
            <option value="bid">bid</option>
            <option value="mid">mid</option>
            <option value="other">other</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          Source label
          <input className={FIELD} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Dukascopy manual export" />
        </label>
        {preset === "generic" ? (
          <>
            <label className="block text-xs text-muted">
              Timezone
              <input className={FIELD} value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" />
            </label>
            <label className="block text-xs text-muted">
              Time format
              <input className={FIELD} value={timeFormat} onChange={(event) => setTimeFormat(event.target.value)} placeholder="%Y-%m-%d %H:%M:%S" />
            </label>
            <label className="block text-xs text-muted sm:col-span-2">
              Columns
              <input className={FIELD} value={columns} onChange={(event) => setColumns(event.target.value)} />
            </label>
          </>
        ) : null}
        <label className="block text-xs text-muted sm:col-span-2">
          File
          <input className={FIELD} type="file" accept=".csv,.zip,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-foreground">
        <label className="flex items-center gap-2"><input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} /> Dry run</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} /> Force a different price side</label>
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      {summary ? (
        <p className="text-sm text-muted">
          Read {summary.rows_read}, kept {summary.rows_kept}, gaps {summary.gap_minutes} min
          {summary.duplicate ? " (already imported)" : ""}
          {Object.keys(summary.rejected).length ? `, rejected ${JSON.stringify(summary.rejected)}` : ""}.
        </p>
      ) : null}
      <button type="submit" className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-white disabled:opacity-60" disabled={importer.isPending}>
        {importer.isPending ? "Importing…" : dryRun ? "Check file" : "Import"}
      </button>
    </form>
  );
}
