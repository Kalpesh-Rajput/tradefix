"use client";

import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { acceptsFile, type BrokerProvider } from "@/lib/brokers/provider";
import { apiMessage, type ImportBatch } from "@/lib/hooks/useProviders";

const MAP_FIELDS = ["symbol", "side", "quantity", "price", "executed_at", "commission"] as const;

export function BrokerFileImportPanel({ provider }: { provider: BrokerProvider }) {
  const accept = acceptsFile(provider);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const columns = useMemo(() => {
    const raw = batch?.rows[0]?.raw;
    return raw ? Object.keys(raw) : [];
  }, [batch]);

  async function upload(file: File) {
    const allowed = accept.split(",").map((item) => item.trim().toLowerCase());
    const lower = file.name.toLowerCase();
    if (!allowed.some((extension) => lower.endsWith(extension))) {
      setError(`Choose a ${accept} file for ${provider.display_name}.`);
      return;
    }
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const form = new FormData();
      form.append("file", file);
      const next = await api.uploadWithProgress<ImportBatch>("/api/imports", form, setProgress);
      setBatch(next);
      setMapping({});
    } catch (err) {
      setError(apiMessage(err));
      setBatch(null);
    } finally {
      setProgress(null);
    }
  }

  async function saveMapping(next: Record<string, string>) {
    if (!batch) return;
    setMapping(next);
    setError(null);
    try {
      const updated = await api.patch<ImportBatch>(`/api/imports/${batch.id}/mapping`, { mapping: next });
      setBatch(updated);
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  async function confirm() {
    if (!batch) return;
    setError(null);
    try {
      const imported = await api.post<{ created: number; duplicates: number; attention: number }>(
        `/api/imports/${batch.id}/confirm`
      );
      setResult(
        `Imported ${imported.created} trades. ${imported.duplicates} already in the journal. ${imported.attention} rows need attention.`
      );
      setBatch({ ...batch, status: "imported" });
    } catch (err) {
      setError(apiMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Upload a {provider.display_name} export. Rows stay in preview until you confirm the import.
      </p>
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
          if (file) void upload(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-2/40"
        }`}
      >
        <FileUp className="h-6 w-6 text-primary" />
        <span className="mt-2 text-sm font-medium text-foreground">Drop a file or click to browse</span>
        <span className="mt-1 text-xs text-muted">{accept}</span>
        <input
          type="file"
          accept={accept}
          className="sr-only"
          aria-label={`Upload ${provider.display_name} export`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
      {progress !== null ? <p className="text-sm text-muted">Uploading… {progress}%</p> : null}
      {error ? <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {batch ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{batch.filename}</p>
            <p className="text-xs text-muted">
              {batch.detected_format} · {batch.valid_count} valid · {batch.attention_count} need attention
            </p>
          </div>
          {columns.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {MAP_FIELDS.map((field) => (
                <label key={field} className="text-xs text-muted">
                  {field}
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm text-foreground"
                    value={mapping[field] ?? ""}
                    aria-label={`Map ${field}`}
                    onChange={(event) => void saveMapping({ ...mapping, [field]: event.target.value })}
                  >
                    <option value="">Not mapped</option>
                    {columns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted">Confirm imports the previewed rows.</p>
          <div className="max-h-48 overflow-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-2 py-2">Symbol</th>
                  <th className="px-2 py-2">Side</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Price</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {batch.rows.slice(0, 12).map((row) => (
                  <tr key={row.row_number} className="border-t border-border">
                    <td className="px-2 py-1.5">{row.normalized.symbol || "—"}</td>
                    <td className="px-2 py-1.5">{row.normalized.side || "—"}</td>
                    <td className="px-2 py-1.5">{row.normalized.quantity || "—"}</td>
                    <td className="px-2 py-1.5">{row.normalized.price || "—"}</td>
                    <td className="px-2 py-1.5">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" disabled={batch.status === "imported"} onClick={() => void confirm()}>
            {batch.status === "imported" ? "Imported" : "Confirm import"}
          </Button>
        </div>
      ) : null}
      {result ? <p className="text-sm text-foreground">{result}</p> : null}
    </div>
  );
}
