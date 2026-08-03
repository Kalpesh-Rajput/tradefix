"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { useImportCsv } from "@/lib/hooks/useTrades";

export function CsvImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const importCsv = useImportCsv();
  const [result, setResult] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importCsv.mutateAsync(file);
      setResult(`Imported ${res.imported} trades (${res.skipped_duplicates} duplicates skipped).`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Import failed");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={importCsv.isPending}>
        {importCsv.isPending ? "Importing…" : "Import CSV"}
      </Button>
      {result && <span className="text-xs text-gray-400">{result}</span>}
    </div>
  );
}
