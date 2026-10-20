"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { OrderTicket } from "@/components/backtest/session/OrderTicket";
import { PositionsTabs } from "@/components/backtest/session/PositionsTabs";
import { SessionSummary } from "@/components/backtest/session/SessionSummary";
import { SessionTopBar } from "@/components/backtest/session/SessionTopBar";
import { useSessionPersistence } from "@/components/backtest/session/useSessionPersistence";
import { CandleChart, type CandleChartHandle } from "@/components/chart";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/components/providers/LocaleProvider";
import { ApiError, api } from "@/lib/api";
import { ReplayEngine } from "@/lib/backtest/replayEngine";
import { buildBatch } from "@/lib/backtest/sessionPersistence";
import { SessionBook, floatingPnl } from "@/lib/backtest/sessionBook";
import { isTimeframe } from "@/lib/backtest/timeframes";
import type { Candle, ReplaySpeed, ReplayState, Timeframe } from "@/lib/backtest/types";
import type { Instrument } from "@/lib/backtest/rules";
import { useCandleSource } from "@/lib/hooks/useCandles";
import { useBacktestSession, useMarketInstruments } from "@/lib/hooks/useBacktestSessions";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const session = useBacktestSession(id);
  const instruments = useMarketInstruments();
  const { timezone } = useLocale();
  const source = useCandleSource(session.data?.symbol ?? null);
  const chartRef = useRef<CandleChartHandle | null>(null);
  const candlesRef = useRef<readonly Candle[]>([]);
  const bookRef = useRef<SessionBook | null>(null);
  const engineRef = useRef<ReplayEngine | null>(null);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [tick, setTick] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const finishedRef = useRef(false);

  const instrument = useMemo<Instrument | null>(() => {
    const row = instruments.data?.find((item) => item.symbol === session.data?.symbol);
    if (!row || !session.data) return null;
    return {
      symbol: row.symbol,
      assetClass: row.asset_class,
      pipSize: row.pip_size,
      contractSize: row.contract_size,
      quoteCurrency: row.quote_currency,
      priceDecimals: row.price_decimals,
    };
  }, [instruments.data, session.data]);

  const readBatch = () => {
    const book = bookRef.current;
    const cursor = engineRef.current?.getState().cursorMs ?? session.data?.cursor_ms;
    if (!book || cursor == null || !session.data) return null;
    return buildBatch(book.orders, book.view().trades, cursor, session.data.notes);
  };
  const persistence = useSessionPersistence(id, readBatch);

  useEffect(() => {
    if (!session.data || !instrument || !source || bookRef.current) return;
    const detail = session.data;
    const book = SessionBook.fromSession(detail, instrument);
    bookRef.current = book;
    const timeframe = isTimeframe(detail.timeframe) ? detail.timeframe : "1m";
    const end = detail.end_ms ?? Date.now();
    const engine = new ReplayEngine({
      source,
      timeframe,
      startMs: Math.max(detail.start_ms, detail.cursor_ms),
      minMs: detail.start_ms,
      endMs: Math.max(end, detail.cursor_ms),
      speed: 10,
      canRewind: () => !book.hasExposure(),
    });
    engineRef.current = engine;
    setFinished(detail.status === "finished");
    finishedRef.current = detail.status === "finished";
    const stop = engine.subscribe((event) => {
      if (finishedRef.current && event.type === "minutes") return;
      const chart = chartRef.current;
      if (event.type === "reset") {
        candlesRef.current = event.candles;
        chart?.setHistory(event.candles);
      } else if (event.type === "candles") {
        for (const candle of event.candles) chart?.updateLast(candle);
        candlesRef.current = engine.candles();
      } else if (event.type === "minutes") {
        for (const minute of event.minutes) book.onBar(minute);
        setTick((value) => value + 1);
      } else if (event.type === "state") {
        setReplay(event.state);
        if (event.state.status === "error") setFailure(event.state.error || "Market data could not be loaded.");
        if (event.state.status === "paused") void persistence.save();
      }
    });
    void engine.load().then(() => setTick((value) => value + 1));
    return () => {
      stop();
      engine.destroy();
      engineRef.current = null;
      bookRef.current = null;
    };
    // The book is created once per session id. Saving must not rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data?.id, instrument?.symbol, source]);

  useEffect(() => {
    if (replay?.status !== "playing" || finished) return;
    const timer = setInterval(() => void persistence.save(), 15_000);
    return () => clearInterval(timer);
  }, [replay?.status, finished, persistence]);

  useEffect(() => {
    const chart = chartRef.current;
    const book = bookRef.current;
    if (!chart || !book) return;
    const view = book.view();
    const theme = chart.theme();
    const lines: { id: string; price: number; color: string; title: string }[] = [];
    if (view.position) {
      lines.push({ id: "entry", price: view.position.entryPrice, color: theme.accent, title: "Entry" });
      if (view.position.sl != null) lines.push({ id: "stop", price: view.position.sl, color: theme.down, title: "Stop" });
      if (view.position.tp != null) lines.push({ id: "target", price: view.position.tp, color: theme.up, title: "Target" });
    }
    view.pending.forEach((item, index) => {
      if (item.order.price != null) lines.push({ id: `pending-${index}`, price: item.order.price, color: theme.text, title: item.order.kind });
    });
    const ids = new Set(lines.map((line) => line.id));
    for (const line of lines) chart.setPriceLine({ ...line, style: line.id === "entry" ? "solid" : "dashed" });
    for (const id of ["entry", "stop", "target", ...view.pending.map((_, index) => `pending-${index}`)]) {
      if (!ids.has(id)) chart.removePriceLine(id);
    }
  }, [tick, replay]);

  if (session.isLoading || instruments.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3" aria-busy="true" aria-label="Loading session">
        <Skeleton className="h-16 shrink-0 rounded-xl" />
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
          <Skeleton className="min-h-[420px] rounded-xl" />
          <Skeleton className="min-h-[420px] rounded-xl" />
        </div>
      </div>
    );
  }
  if (session.isError || !session.data || !instrument) {
    return (
      <div className="dash-card mx-auto w-full max-w-md px-6 py-10 text-center">
        <h1 className="text-base font-semibold text-foreground">Couldn’t open this session</h1>
        <p className="mt-1 text-sm text-muted">It may have been removed, or the connection failed.</p>
        <button type="button" className="dash-btn-primary mx-auto mt-4" onClick={() => session.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const book = bookRef.current;
  const view = book?.view();
  const mark = candlesRef.current.at(-1)?.close ?? null;
  const floating = view ? floatingPnl(view.position, mark, instrument) : 0;
  const balance = view?.balance ?? session.data.stats.balance;

  async function confirmFinish() {
    const current = bookRef.current;
    const cursor = engineRef.current?.getState().cursorMs ?? session.data!.cursor_ms;
    const price = candlesRef.current.at(-1)?.close;
    if (!current || price == null) {
      setFailure("Wait for a candle before finishing.");
      return;
    }
    engineRef.current?.pause();
    current.finish(cursor, price);
    finishedRef.current = true;
    setFinished(true);
    setConfirming(false);
    setTick((value) => value + 1);
    const saved = await persistence.save(buildBatch(current.orders, current.view().trades, cursor, session.data!.notes));
    if (!saved) return;
    try {
      await api.post(`/api/backtest/sessions/${id}/finish`);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : "Couldn’t finish the session.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <SessionTopBar
        symbol={session.data.symbol}
        timeframe={session.data.timeframe}
        status={finished ? "finished" : replay?.status ?? session.data.status}
        balance={balance}
        equity={balance + floating}
        floating={floating}
        currency={session.data.currency}
        finished={finished}
        canRewind={!book?.hasExposure()}
        confirming={confirming}
        onFinish={() => setConfirming(true)}
        onConfirmFinish={() => void confirmFinish()}
        onCancelFinish={() => setConfirming(false)}
        replay={replay}
        onToggle={() => {
          engineRef.current?.toggle();
        }}
        onStep={() => void engineRef.current?.stepMinute()}
        onStepBack={() => void engineRef.current?.stepBack("minute")}
        onSpeed={(speed: ReplaySpeed) => engineRef.current?.setSpeed(speed)}
        onTimeframe={(timeframe: Timeframe) => void engineRef.current?.setTimeframe(timeframe)}
        savePhase={persistence.phase}
        saveDetail={persistence.detail}
      />
      {failure ? (
        <p role="alert" className="rounded-lg border border-[var(--color-danger-light)] bg-negative-soft px-3 py-2 text-sm text-negative">
          {failure}
        </p>
      ) : null}
      <div className="grid min-h-[40rem] flex-1 grid-cols-1 items-stretch gap-3 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:grid-rows-[minmax(0,1fr)_auto]">
        <div className="dash-card flex h-full min-h-[420px] flex-col overflow-hidden p-1 lg:min-h-0">
          <CandleChart ref={chartRef} timeZone={timezone} priceDecimals={instrument.priceDecimals} ariaLabel={`${session.data.symbol} session chart`} className="min-h-0 flex-1" />
        </div>
        <div className="h-full min-h-0 lg:row-span-2">
          <OrderTicket
            instrument={instrument}
            balance={balance}
            mark={mark}
            hasPosition={!!view?.position}
            disabled={finished || !book}
            onPlace={(input) => {
              const current = bookRef.current;
              if (!current) return "Session is still loading.";
              const message = current.place({ ...input, nowMs: engineRef.current?.getState().cursorMs ?? session.data.cursor_ms, mark });
              if (message) return message;
              setTick((value) => value + 1);
              void persistence.save();
              return null;
            }}
            onClose={() => {
              bookRef.current?.requestClose(engineRef.current?.getState().cursorMs ?? session.data.cursor_ms);
              setTick((value) => value + 1);
            }}
          />
        </div>
        {view && book ? (
          <PositionsTabs
            view={view}
            orders={book.orders}
            currency={session.data.currency}
            sessionId={id}
            onCancel={(orderId) => {
              book.requestCancel(orderId);
              setTick((value) => value + 1);
            }}
          />
        ) : (
          <Skeleton className="h-40 rounded-xl" />
        )}
      </div>
      {finished && view ? (
        <SessionSummary
          sessionId={id}
          currency={session.data.currency}
          initialBalance={session.data.initial_balance}
          trades={view.trades}
          warnings={session.data.warnings}
        />
      ) : null}
    </div>
  );
}
