"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAccountPrefs } from "@/components/providers/AccountProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { TIMEFRAMES } from "@/lib/backtest/timeframes";
import { useCreateSession, useMarketInstruments } from "@/lib/hooks/useBacktestSessions";

const FIELD = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary";

export function SessionSetupForm() {
  const router = useRouter();
  const toast = useToast();
  const instruments = useMarketInstruments();
  const create = useCreateSession();
  const { activeAccount } = useAccountPrefs();
  const [query, setQuery] = useState("");
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("1m");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [balance, setBalance] = useState("10000");
  const [currency, setCurrency] = useState("USD");
  const [spread, setSpread] = useState("0");
  const [commission, setCommission] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const rows = (instruments.data ?? []).filter((item) => !needle || item.symbol.includes(needle) || item.asset_class.includes(needle.toLowerCase()));
    const groups = new Map<string, typeof rows>();
    for (const item of rows) {
      const list = groups.get(item.asset_class) ?? [];
      list.push(item);
      groups.set(item.asset_class, list);
    }
    return [...groups.entries()];
  }, [instruments.data, query]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!symbol) {
      setFormError("Choose an instrument.");
      return;
    }
    const startMs = start ? new Date(start).getTime() : Number.NaN;
    if (!Number.isFinite(startMs)) {
      setFormError("Choose a start date and time.");
      return;
    }
    const endMs = end ? new Date(end).getTime() : null;
    if (endMs != null && (!Number.isFinite(endMs) || endMs <= startMs)) {
      setFormError("The end has to be after the start.");
      return;
    }
    const initial = Number(balance);
    if (!Number.isFinite(initial) || initial <= 0) {
      setFormError("Balance has to be greater than zero.");
      return;
    }
    const spreadPips = Number(spread);
    const commissionPerLot = Number(commission);
    if (!Number.isFinite(spreadPips) || spreadPips < 0 || !Number.isFinite(commissionPerLot) || commissionPerLot < 0) {
      setFormError("Spread and commission can’t be negative.");
      return;
    }
    try {
      const created = await create.mutateAsync({
        symbol,
        timeframe,
        start_ms: startMs,
        end_ms: endMs,
        initial_balance: initial,
        currency: currency.trim().toUpperCase() || "USD",
        spread_pips: spreadPips,
        commission_per_lot: commissionPerLot,
        account_id: activeAccount?.id ?? null,
      });
      toast.success("Session started", symbol);
      router.push(`/backtest/sessions/${created.id}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Try again.";
      setFormError(message);
      toast.error("Couldn’t start the session", message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="dash-card space-y-5 p-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">New manual session</h1>
        <p className="mt-1 text-sm text-muted">
          Market orders fill at the next candle’s open. When one candle can hit both the stop and the target, the stop is filled first.
          The start time has to fall inside candles already stored for the symbol.
        </p>
      </div>

      {instruments.isLoading ? <Skeleton className="h-24" /> : null}
      {instruments.isError ? (
        <p className="text-sm text-negative">
          Couldn’t load instruments.{" "}
          <button type="button" className="text-primary hover:underline" onClick={() => instruments.refetch()}>
            Retry
          </button>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Instrument</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbol"
            className={FIELD}
            aria-label="Search instruments"
          />
          <select
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            className={`${FIELD} mt-2`}
            required
          >
            <option value="">Select a symbol</option>
            {grouped.map(([asset, items]) => (
              <optgroup key={asset} label={asset}>
                {items.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol} · {item.source}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Start</span>
          <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className={FIELD} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">End (optional)</span>
          <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className={FIELD} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Initial balance</span>
          <input value={balance} onChange={(event) => setBalance(event.target.value)} inputMode="decimal" className={FIELD} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Currency</span>
          <input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={8} className={FIELD} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Timeframe</span>
          <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)} className={FIELD}>
            {TIMEFRAMES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Spread (pips)</span>
          <input value={spread} onChange={(event) => setSpread(event.target.value)} inputMode="decimal" className={FIELD} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Commission per lot</span>
          <input value={commission} onChange={(event) => setCommission(event.target.value)} inputMode="decimal" className={FIELD} />
        </label>
      </div>

      {formError ? <p className="text-sm text-negative">{formError}</p> : null}
      <button type="submit" className="dash-btn-primary text-on-accent h-10 px-4" disabled={create.isPending || instruments.isLoading}>
        {create.isPending ? "Starting…" : "Start session"}
      </button>
    </form>
  );
}
