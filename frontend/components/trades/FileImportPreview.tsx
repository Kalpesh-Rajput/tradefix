"use client";

import clsx from "clsx";
import { FileUp } from "lucide-react";
import { useEffect, useState } from "react";

import { FileColumnSheet } from "@/components/add-trades/FileColumnSheet";
import { AccountPicker } from "@/components/accounts/AccountPicker";
import { Button } from "@/components/ui/Button";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { useToast } from "@/components/ui/Toast";
import { useAccounts } from "@/lib/hooks/useAccounts";
import { apiMessage, type ImportBatch } from "@/lib/hooks/useProviders";
import { useConfirmImport, useUpdateImportMapping, useUploadImport } from "@/lib/hooks/useImports";

const MAX_BYTES = 10 * 1024 * 1024;

const MAP_FIELDS = [
  {
    field: "symbol",
    label: "Symbol",
    help: "The market you traded. Pick the column with the ticker or pair.\nExample: GBPUSD, AAPL, BTCUSDT",
  },
  {
    field: "side",
    label: "Side",
    help: "Buy or sell. Long counts as buy, and short counts as sell.\nExample: buy, sell, long, short",
  },
  {
    field: "quantity",
    label: "Quantity",
    help: "How many units, lots, or shares were filled.\nExample: 1, 0.10, 100",
  },
  {
    field: "price",
    label: "Entry price",
    help: "Price where the trade opened. Use this for a buy, or for a short you sold to open.\nExample: 100, 1.0850",
  },
  {
    field: "exit_price",
    label: "Exit price",
    help: "Price where the trade closed. A sell row can use this when that row has no entry price.\nExample: 105, 1.0902",
  },
  {
    field: "executed_at",
    label: "Open time",
    help: "When the trade was opened.\nExample: 2026-10-08 08:07:00",
  },
  {
    field: "closed_at",
    label: "Close time",
    help: "When the trade was closed. A sell row can use this when that row has no open time.\nExample: 2026-10-08 09:15:00",
  },
  {
    field: "commission",
    label: "Commission",
    help: "Optional. Broker fee charged on the trade.\nExample: 1.25, 0.50",
  },
  {
    field: "external_id",
    label: "Ticket",
    help: "Optional. Broker order or deal id. Used to skip a trade you already imported.\nExample: 1001, deal-9",
  },
] as const;

interface FileImportPreviewProps {
  accountId?: string | null;
  accept: string;
  acceptLabel: string;
  layout?: "step" | "panel";
  accountLabel?: string | null;
  isDemo?: boolean;
  hint?: string;
  onImported?: (created: number) => void;
}

export function FileImportPreview({
  accountId,
  accept,
  acceptLabel,
  layout = "panel",
  accountLabel,
  isDemo = false,
  hint,
  onImported,
}: FileImportPreviewProps) {
  const toast = useToast();
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];
  const upload = useUploadImport();
  const updateMapping = useUpdateImportMapping();
  const confirmImport = useConfirmImport();
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedAccountId, setSelectedAccountId] = useState(accountId ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const headers = batch?.headers?.length ? batch.headers : Object.keys(batch?.rows[0]?.raw ?? {});
  const busy = upload.isPending || updateMapping.isPending || confirmImport.isPending;
  const imported = batch?.status === "imported";

  useEffect(() => {
    if (selectedAccountId) return;
    if (accountId) {
      setSelectedAccountId(accountId);
      return;
    }
    const fallback = accounts.find((account) => account.is_default) ?? accounts[0];
    if (fallback) setSelectedAccountId(fallback.id);
  }, [accountId, accounts, selectedAccountId]);

  async function onFile(file: File) {
    const allowed = accept.split(",").map((item) => item.trim().toLowerCase());
    const lower = file.name.toLowerCase();
    if (!allowed.some((extension) => lower.endsWith(extension))) {
      setError(`Choose a ${acceptLabel} file.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is larger than 10 MB.");
      return;
    }
    if (!selectedAccountId) {
      setError("Choose the account these trades should be added to.");
      return;
    }
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const next = await upload.mutateAsync({ file, accountId: selectedAccountId, onProgress: setProgress });
      setBatch(next);
      setMapping(next.mapping ?? {});
      if (next.account_id) setSelectedAccountId(next.account_id);
    } catch (err) {
      setBatch(null);
      setError(apiMessage(err));
    } finally {
      setProgress(null);
    }
  }

  async function onMap(field: string, column: string) {
    if (!batch) return;
    const next = { ...mapping };
    if (column) next[field] = column;
    else delete next[field];
    setMapping(next);
    setError(null);
    try {
      const updated = await updateMapping.mutateAsync({
        batchId: batch.id,
        mapping: next,
        accountId: selectedAccountId || undefined,
      });
      setBatch(updated);
      setMapping(updated.mapping ?? {});
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  async function onAccount(nextId: string) {
    const previous = selectedAccountId;
    setSelectedAccountId(nextId);
    setError(null);
    if (!batch || imported) return;
    try {
      const updated = await updateMapping.mutateAsync({
        batchId: batch.id,
        mapping,
        accountId: nextId,
      });
      setBatch(updated);
      setMapping(updated.mapping ?? {});
    } catch (err) {
      setSelectedAccountId(previous);
      setError(apiMessage(err));
    }
  }

  async function onConfirm() {
    if (!batch || imported) return;
    setError(null);
    try {
      const importedResult = await confirmImport.mutateAsync(batch.id);
      const message = savedMessage(importedResult);
      setResult(message);
      setBatch({ ...batch, status: "imported", valid_count: importedResult.created });
      toast.success("Trades imported", message);
      onImported?.(importedResult.created);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  const accountControl = (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted">
        <span>Account</span>
        <InfoTooltip
          label="Account"
          content={"Journal account these trades are saved to.\nExample: Demo, AvaTrade"}
        />
      </div>
      <AccountPicker
        className="mt-1"
        accounts={accounts}
        value={selectedAccountId}
        onChange={(id) => void onAccount(id)}
        disabled={busy || imported}
        size="sm"
        tone="trade"
        placeholder={accountLabel || "Select account"}
        getLabel={(account) => (account.id === accountId && isDemo ? `${account.name} · Demo` : account.name)}
      />
    </div>
  );

  const body = (
    <>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {batch ? null : <FileColumnSheet variant="strip" />}
      {batch ? null : accountControl}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files[0];
          if (file) void onFile(file);
        }}
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-2/40"
        )}
      >
        <FileUp className="h-6 w-6 text-primary" />
        <span className="mt-2 text-sm font-medium text-foreground">
          {progress === null ? "Drop a file or click to browse" : progress >= 100 ? "Checking rows…" : `Uploading… ${progress}%`}
        </span>
        <span className="mt-1 text-xs text-muted">{acceptLabel}</span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          aria-label="Upload trading history"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = "";
          }}
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {batch ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{batch.filename}</p>
            <p className="text-xs text-muted">
              {formatLabel(batch.detected_format)} · {tally(batch.valid_count, "ready", "ready")} ·{" "}
              {tally(batch.duplicate_count, "duplicate", "duplicates")} · {attentionTally(batch.attention_count)}
            </p>
          </div>
          {batch.unmapped_required && batch.unmapped_required.length > 0 ? (
            <p className="text-xs text-muted">
              Map {batch.unmapped_required.map(fieldLabel).join(", ")} before those rows can be imported.
            </p>
          ) : null}
          {accountControl}
          {headers.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {MAP_FIELDS.map((item) => (
                <MappingField
                  key={item.field}
                  field={item.field}
                  label={item.label}
                  help={item.help}
                  headers={headers}
                  mapping={mapping}
                  disabled={busy || imported}
                  onChange={(column) => void onMap(item.field, column)}
                />
              ))}
            </div>
          ) : null}
          <div className="max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="sticky top-0 bg-surface-2 text-muted">
                <tr>
                  <th className="px-2 py-2 font-medium">Symbol</th>
                  <th className="px-2 py-2 font-medium">Side</th>
                  <th className="px-2 py-2 font-medium">Qty</th>
                  <th className="px-2 py-2 font-medium">Entry</th>
                  <th className="px-2 py-2 font-medium">Exit</th>
                  <th className="px-2 py-2 font-medium">Open time</th>
                  <th className="px-2 py-2 font-medium">Close time</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((row) => {
                  const exitFill = row.normalized.side === "sell" && !row.normalized.price && !!row.normalized.exit_price;
                  return (
                    <tr key={row.row_number} className="border-t border-border align-top">
                      <td className="px-2 py-1.5">{row.normalized.symbol || "—"}</td>
                      <td className="px-2 py-1.5">{row.normalized.side || "—"}</td>
                      <td className="px-2 py-1.5">{row.normalized.quantity || "—"}</td>
                      <td className="px-2 py-1.5">{row.normalized.price || "—"}</td>
                      <td className={clsx("px-2 py-1.5", exitFill && "font-medium text-foreground")}>
                        {row.normalized.exit_price || "—"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">{shortTime(row.normalized.executed_at)}</td>
                      <td className={clsx("whitespace-nowrap px-2 py-1.5", exitFill && "font-medium text-foreground")}>
                        {shortTime(row.normalized.closed_at)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={statusClass(row.status)}>{statusLabel(row.status)}</span>
                        {row.errors?.length ? (
                          <span className="mt-0.5 block text-[11px] text-muted">{row.errors.join(" · ")}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {batch.row_count > batch.rows.length ? (
            <p className="text-xs text-muted">Showing the first {batch.rows.length} of {batch.row_count} rows.</p>
          ) : null}
          <p className="text-xs text-muted">
            Ready rows are saved. A buy followed by a sell in the same symbol becomes one closed trade. Duplicates and rows that need attention are left out.
          </p>
        </div>
      ) : null}
      {result ? <p className="text-sm text-foreground">{result}</p> : null}
    </>
  );

  const confirmDisabled = !batch || imported || busy || batch.valid_count === 0 || !selectedAccountId;
  const confirmText = confirmImport.isPending
    ? "Importing…"
    : imported
      ? "Imported"
      : batch
        ? `Confirm ${tally(batch.valid_count, "row", "rows")}`
        : "Confirm";

  if (layout === "panel") {
    return (
      <div className="space-y-4">
        {body}
        {batch ? (
          <Button type="button" disabled={confirmDisabled} onClick={() => void onConfirm()}>
            {confirmText}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-1">
      <div className="shrink-0 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Add Trades</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Review import</h2>
      </div>
      <div className="mt-8 min-h-0 flex-1 space-y-4 overflow-y-auto">{body}</div>
      <div className="mt-8 shrink-0">
        <Button type="button" size="lg" className="w-full" disabled={confirmDisabled} onClick={() => void onConfirm()}>
          {confirmText}
        </Button>
      </div>
    </div>
  );
}

function MappingField({
  field,
  label,
  help,
  headers,
  mapping,
  disabled,
  onChange,
}: {
  field: string;
  label: string;
  help: string;
  headers: string[];
  mapping: Record<string, string>;
  disabled: boolean;
  onChange: (column: string) => void;
}) {
  const taken = new Set(
    Object.entries(mapping)
      .filter(([key, column]) => key !== field && column)
      .map(([, column]) => column)
  );
  return (
    <div className="text-xs text-muted">
      <div className="flex items-center gap-1">
        <label htmlFor={`import-map-${field}`}>{label}</label>
        <InfoTooltip content={help} label={label} />
      </div>
      <select
        id={`import-map-${field}`}
        className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
        value={mapping[field] ?? ""}
        aria-label={`Map ${label}`}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Not mapped</option>
        {headers.map((column) => (
          <option key={column} value={column} disabled={taken.has(column)}>
            {column}
          </option>
        ))}
      </select>
    </div>
  );
}

function savedMessage(result: { created: number; duplicates: number; attention: number }): string {
  const parts = [`Saved ${tally(result.created, "trade", "trades")}`];
  if (result.duplicates) parts.push(`${tally(result.duplicates, "duplicate", "duplicates")} already in the journal`);
  if (result.attention) parts.push(attentionTally(result.attention));
  return `${parts.join(". ")}.`;
}

function formatLabel(kind: string): string {
  if (kind === "xlsx") return "Excel";
  if (kind === "xml" || kind === "tradefix-xml") return "XML";
  if (kind === "zerodha-tradebook-csv") return "Zerodha tradebook";
  if (kind === "mt4-html" || kind === "mt5-html") return "MetaTrader statement";
  return "CSV";
}

function fieldLabel(field: string): string {
  return MAP_FIELDS.find((item) => item.field === field)?.label ?? field;
}

function tally(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function attentionTally(count: number): string {
  return count === 1 ? "1 needs attention" : `${count} need attention`;
}

function statusLabel(status: string): string {
  if (status === "valid") return "Ready";
  if (status === "duplicate") return "Duplicate";
  return "Needs attention";
}

function statusClass(status: string): string {
  if (status === "valid") return "text-positive";
  if (status === "duplicate") return "text-muted";
  return "text-destructive";
}

function shortTime(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace("T", " ").replace("+00:00", " UTC").slice(0, 19);
}
