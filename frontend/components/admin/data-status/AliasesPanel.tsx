"use client";

import { useState, type FormEvent } from "react";

import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { useAliases, useCreateAlias, useDeleteAlias } from "@/lib/hooks/useDataStatus";

const FIELD = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary";

export function AliasesPanel() {
  const aliases = useAliases();
  const create = useCreateAlias();
  const remove = useDeleteAlias();
  const toast = useToast();
  const [broker, setBroker] = useState("");
  const [raw, setRaw] = useState("");
  const [canonical, setCanonical] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!broker.trim() || !raw.trim() || !canonical.trim()) {
      setError("Broker, raw symbol and canonical symbol are required.");
      return;
    }
    create.mutate(
      { broker: broker.trim(), raw_symbol: raw.trim(), canonical: canonical.trim() },
      {
        onSuccess: () => {
          toast.success("Alias saved");
          setRaw("");
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Try again."),
      },
    );
  }

  return (
    <section className="dash-card space-y-3 p-4">
      <h2 className="text-sm font-medium text-foreground">Aliases</h2>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-4">
        <input className={FIELD} placeholder="Broker" value={broker} onChange={(event) => setBroker(event.target.value)} />
        <input className={FIELD} placeholder="Raw symbol" value={raw} onChange={(event) => setRaw(event.target.value)} />
        <input className={FIELD} placeholder="Canonical" value={canonical} onChange={(event) => setCanonical(event.target.value)} />
        <button type="submit" className="dash-btn-secondary h-10 px-3 text-sm" disabled={create.isPending}>Add alias</button>
      </form>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
      {aliases.isLoading ? <Skeleton className="h-16" /> : null}
      {aliases.isError ? <p className="text-sm text-negative">Couldn’t load aliases.</p> : null}
      <ul className="divide-y divide-border">
        {(aliases.data ?? []).map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>{row.broker} · {row.raw_symbol} → {row.canonical_symbol}</span>
            <button type="button" className="text-muted hover:text-foreground" onClick={() => remove.mutate(row.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
