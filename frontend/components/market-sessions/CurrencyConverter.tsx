"use client";

import clsx from "clsx";
import { AlertTriangle, ArrowLeftRight, RefreshCw } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { SessionFlag } from "@/components/market-sessions/SessionFlag";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { currencyByCode, isValidCode, presetLabel, swapPair } from "@/lib/fx/catalog";
import {
  convertAmount,
  formatAbsoluteTimestamp,
  formatGroupedAmount,
  formatRate,
  formatRelativeTimestamp,
  freshnessLabel,
  parseAmount,
  parseIsoDate,
  roundTo,
  sanitizeAmountInput,
} from "@/lib/fx/format";
import { readFxConverterPrefs, writeFxConverterPrefs } from "@/lib/fx";
import { AMOUNT_PRESETS, CURRENCY_ALIASES, FALLBACK_CURRENCIES, POPULAR_PAIRS, type FxCurrency } from "@/lib/fx/types";
import { useFxCurrencies, useFxQuote } from "@/lib/hooks/useFxQuote";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { HourCycle } from "@/lib/market-sessions/types";

export function CurrencyConverter({
  timezone,
  hourCycle,
}: {
  timezone: string;
  hourCycle: HourCycle;
}) {
  const { t } = useLocale();
  const amountId = useId();
  const prefs = useMemo(() => readFxConverterPrefs(), []);
  const [base, setBase] = useState(prefs.base);
  const [quote, setQuote] = useState(prefs.quote);
  const [amount, setAmount] = useState(prefs.amount);
  const [draft, setDraft] = useState(() => formatGroupedAmount(prefs.amount, 2));
  const [focused, setFocused] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const currenciesQuery = useFxCurrencies();
  const currencies = currenciesQuery.data?.length ? currenciesQuery.data : FALLBACK_CURRENCIES;
  const fx = useFxQuote(base, quote);

  const from = currencyByCode(currencies, base) ?? {
    code: base,
    name: base,
    symbol: base,
    flag: base.slice(0, 2),
    decimals: 2,
  };
  const to = currencyByCode(currencies, quote) ?? {
    code: quote,
    name: quote,
    symbol: quote,
    flag: quote.slice(0, 2),
    decimals: 2,
  };

  useEffect(() => {
    writeFxConverterPrefs({ base, quote, amount });
  }, [base, quote, amount]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!focused) setDraft(formatGroupedAmount(amount, from.decimals));
  }, [amount, from.decimals, focused]);

  const converted = fx.quote ? roundTo(convertAmount(amount, fx.quote.rate), to.decimals) : null;
  const rateTs = parseIsoDate(fx.quote?.rate_timestamp);
  const fetchedAt = parseIsoDate(fx.quote?.fetched_at);
  const freshness = fx.quote ? freshnessLabel(fx.quote.freshness, fx.quote.delayed) : null;
  const showStaleWarning = fx.refreshFailed && Boolean(fx.quote);
  const unavailable = !fx.quote && Boolean(fx.error) && !fx.isLoading;

  const options = useMemo(
    () =>
      currencies.map((item) => ({
        value: item.code,
        label: item.code,
        description: item.name,
        icon: <SessionFlag currency={item.code} code={item.flag} title={item.name} />,
        keywords: [item.symbol, item.name, item.code, ...(CURRENCY_ALIASES[item.code] ?? [])].join(" "),
      })),
    [currencies]
  );

  function onAmountChange(raw: string) {
    const next = sanitizeAmountInput(raw);
    if (next == null) return;
    setDraft(next);
    const parsed = parseAmount(next);
    if (parsed != null) setAmount(parsed);
    if (next === "") setAmount(0);
  }

  function applyPair(nextBase: string, nextQuote: string) {
    if (!isValidCode(nextBase) || !isValidCode(nextQuote)) return;
    setBase(nextBase);
    setQuote(nextQuote);
  }

  function onSwap() {
    const next = swapPair(base, quote);
    setSwapped((value) => !value);
    applyPair(next.base, next.quote);
  }

  return (
    <section className="min-w-0">
      <div className="mb-2.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          {t("marketSessions.converter.title")}
        </h2>
        <p className="text-[11px] text-[var(--color-text-tertiary)]">{t("marketSessions.converter.subtitle")}</p>
      </div>

      <div className="ms-card min-w-0 overflow-hidden p-3.5 sm:p-4">
        <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <CurrencySide
            label="From"
            currency={from}
            options={options}
            selectId={`${amountId}-from`}
            amountId={amountId}
            amountValue={focused ? draft : formatGroupedAmount(amount, from.decimals)}
            onAmountChange={onAmountChange}
            onFocus={() => {
              setFocused(true);
              setDraft(amount === 0 ? "" : String(amount));
            }}
            onBlur={() => {
              setFocused(false);
              setDraft(formatGroupedAmount(amount, from.decimals));
            }}
            onCurrency={(code) => applyPair(code, code === quote ? base : quote)}
            editable
          />

          <div className="flex items-center justify-center md:px-1">
            <button
              type="button"
              onClick={onSwap}
              aria-label={`Swap currencies, currently ${base} to ${quote}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] transition hover:border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <ArrowLeftRight
                className={clsx("fx-swap-icon h-4 w-4", swapped && "is-flipped")}
                aria-hidden
              />
            </button>
          </div>

          <CurrencySide
            label="To"
            currency={to}
            options={options}
            selectId={`${amountId}-to`}
            amountValue={
              fx.isLoading
                ? ""
                : converted == null
                  ? "—"
                  : formatGroupedAmount(converted, to.decimals)
            }
            loading={fx.isLoading}
            onCurrency={(code) => applyPair(code === base ? quote : base, code)}
          />
        </div>

        {unavailable ? (
          <div
            className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_28%,var(--color-border))] bg-[var(--color-danger-bg)] px-3 py-2.5"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Rate unavailable</p>
              <p className="text-[12px] text-[var(--color-text-secondary)]">
                Unable to retrieve the latest exchange rate.
              </p>
            </div>
            <button type="button" className="fx-chip" onClick={() => void fx.refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-[var(--color-border)] pt-3">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <div className="min-w-0" aria-live="polite">
                <p className="text-[15px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
                  {fx.quote ? `1 ${base} = ${to.symbol}\u00a0${formatRate(fx.quote.rate)}` : "Fetching latest available rate…"}
                </p>
                {fx.quote ? (
                  <RateMeta
                    delayed={fx.quote.delayed}
                    freshness={freshness}
                    rateTs={rateTs}
                    fetchedAt={fetchedAt}
                    source={fx.quote.source}
                    attribution={fx.quote.source_attribution}
                    timezone={timezone}
                    hourCycle={hourCycle}
                    now={now}
                    refreshFailed={showStaleWarning}
                  />
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => fx.forceRefresh()}
                disabled={fx.refreshing}
                aria-label="Refresh exchange rate"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-60"
              >
                <RefreshCw className={clsx("h-3.5 w-3.5", fx.refreshing && "animate-spin")} aria-hidden />
                Refresh rate
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex min-w-0 flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Amount</p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {AMOUNT_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className={clsx("fx-chip", amount === value && "is-active")}
                onClick={() => setAmount(value)}
              >
                {from.symbol}
                {presetLabel(value)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Popular</p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {POPULAR_PAIRS.map(([pairBase, pairQuote]) => {
              const active = base === pairBase && quote === pairQuote;
              return (
                <button
                  key={`${pairBase}-${pairQuote}`}
                  type="button"
                  className={clsx("fx-chip", active && "is-active")}
                  onClick={() => applyPair(pairBase, pairQuote)}
                  aria-pressed={active}
                >
                  {pairBase} / {pairQuote}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function CurrencySide({
  label,
  currency,
  options,
  selectId,
  amountId,
  amountValue,
  onAmountChange,
  onFocus,
  onBlur,
  onCurrency,
  editable = false,
  loading = false,
}: {
  label: string;
  currency: FxCurrency;
  options: { value: string; label: string; description?: string; keywords?: string; icon?: ReactNode }[];
  selectId: string;
  amountId?: string;
  amountValue: string;
  onAmountChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onCurrency: (code: string) => void;
  editable?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <SearchableSelect
        id={selectId}
        value={currency.code}
        onChange={onCurrency}
        options={options}
        aria-label={`${label} currency`}
        searchPlaceholder="Search code, name, or symbol"
        triggerClassName="!bg-[var(--color-surface)] !py-2"
      />
      <div className="mt-3 flex min-w-0 items-baseline gap-1.5">
        <span className="shrink-0 text-[18px] font-semibold text-[var(--color-text-tertiary)]">{currency.symbol}</span>
        {loading ? (
          <span className="fx-skeleton h-8 w-full max-w-[220px]" aria-hidden />
        ) : editable ? (
          <input
            id={amountId}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            aria-label={`${label} amount in ${currency.name}`}
            value={amountValue}
            onChange={(e) => onAmountChange?.(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="0"
            className="min-w-0 w-full border-0 bg-transparent p-0 text-[28px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
          />
        ) : (
          <p className="min-w-0 truncate text-[28px] font-semibold tabular-nums tracking-tight text-[var(--color-text-primary)]">
            {amountValue}
          </p>
        )}
      </div>
    </div>
  );
}

function RateMeta({
  delayed,
  freshness,
  rateTs,
  fetchedAt,
  source,
  attribution,
  timezone,
  hourCycle,
  now,
  refreshFailed,
}: {
  delayed: boolean;
  freshness: { label: string; tone: "ok" | "warn" | "stale" } | null;
  rateTs: Date | null;
  fetchedAt: Date | null;
  source: string;
  attribution: string;
  timezone: string;
  hourCycle: HourCycle;
  now: Date;
  refreshFailed: boolean;
}) {
  const relativeFrom = fetchedAt ?? rateTs;
  const distinctTimestamps = Boolean(rateTs && fetchedAt && Math.abs(rateTs.getTime() - fetchedAt.getTime()) > 1000);

  return (
    <div className="mt-1.5 space-y-0.5 text-[12px] text-[var(--color-text-secondary)]">
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 font-medium",
            freshness?.tone === "stale" || refreshFailed
              ? "text-[var(--color-danger)]"
              : freshness?.tone === "warn"
                ? "text-[var(--color-text-secondary)]"
                : "text-[var(--color-text-primary)]"
          )}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              freshness?.tone === "stale" || refreshFailed
                ? "bg-[var(--color-danger)]"
                : freshness?.tone === "warn"
                  ? "fx-cached-dot"
                  : "ms-live-dot"
            )}
            style={freshness?.tone === "ok" ? undefined : { animation: "none", boxShadow: "none" }}
            aria-hidden
          />
          {refreshFailed ? "Unable to refresh" : freshness?.label}
          {delayed && freshness?.tone === "ok" ? <span className="font-normal text-[var(--color-text-muted)]">· Delayed</span> : null}
        </span>
        {relativeFrom ? <span>Updated {formatRelativeTimestamp(relativeFrom, now)}</span> : null}
      </p>
      {rateTs ? (
        <p>
          {distinctTimestamps ? "Market rate " : "Updated "}
          {formatAbsoluteTimestamp(rateTs, timezone, hourCycle)}
        </p>
      ) : null}
      {distinctTimestamps && fetchedAt ? (
        <p>Fetched {formatAbsoluteTimestamp(fetchedAt, timezone, hourCycle)}</p>
      ) : !rateTs && fetchedAt ? (
        <p>Fetched {formatAbsoluteTimestamp(fetchedAt, timezone, hourCycle)}</p>
      ) : null}
      <p className="text-[11px] text-[var(--color-text-muted)]">{attribution || `Source: ${source}`}</p>
    </div>
  );
}
