import { ApiError, api } from "@/lib/api";
import type { Candle, CandleSource, Timeframe } from "./types";
import { timeframeMs } from "./timeframes";

export type ReplayTrade = {
  side: "long" | "short";
  size: number;
  entry_ms: number;
  entry_price: number;
  exit_ms: number | null;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  fees: number | null;
};

export type ReplayInstrument = {
  symbol: string;
  asset_class: string;
  pip_size: number;
  price_decimals: number;
  quote_currency: string;
};

export type ReplayPayload = {
  status: "ready" | "preparing";
  job_id: string | null;
  source: "journal" | "session" | "run";
  trade_ref: string;
  instrument: ReplayInstrument;
  trade: ReplayTrade;
  default_timeframe: string;
  suggested_start_ms: number;
  window_start_ms: number;
  window_end_ms: number;
  time_basis: { basis: string; rule: string; tz_label: string | null };
  price_note: string | null;
  alignment: {
    tolerance: number;
    offset_suggestion: { based_on: "entry" | "exit"; price_delta: number; points: number } | null;
  } | null;
};

export type DataJob = {
  id: string;
  type: string;
  status: string;
  progress: number;
  progress_message: string | null;
  error_code: string | null;
  error_message: string | null;
};

type CandleColumns = {
  status?: string;
  code?: string;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
};

const PREPARING_WAIT_MS = 2_000;
const MAX_POLLS = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function candlesFromColumns(body: CandleColumns): Candle[] {
  const count = Math.min(body.t.length, body.o.length, body.h.length, body.l.length, body.c.length);
  const out: Candle[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      time: body.t[i],
      open: body.o[i],
      high: body.h[i],
      low: body.l[i],
      close: body.c[i],
      volume: body.v[i] ?? 0,
    });
  }
  return out;
}

function isPreparing(body: unknown): body is { code: "data_preparing"; job_id?: string } {
  return !!body && typeof body === "object" && (body as { code?: string }).code === "data_preparing";
}

async function waitForJob(jobId: string | undefined): Promise<void> {
  if (!jobId) {
    await sleep(PREPARING_WAIT_MS);
    return;
  }
  for (let i = 0; i < MAX_POLLS; i += 1) {
    const job = await api.get<DataJob>(`/api/market-data/jobs/${jobId}`);
    if (job.status === "succeeded") return;
    if (job.status === "failed" || job.status === "cancelled") {
      throw new ApiError(job.error_message || "Market data could not be prepared.", 503, {
        code: "data_unavailable",
        jobId,
      });
    }
    await sleep(PREPARING_WAIT_MS);
  }
  throw new ApiError("Market data is still being prepared.", 202, { code: "data_preparing", jobId });
}

export async function loadCandles(query: {
  symbol: string;
  timeframe: Timeframe;
  start: number;
  end: number;
  until?: number;
  limit?: number;
}): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol: query.symbol,
    timeframe: query.timeframe,
    start: String(query.start),
    end: String(query.end),
  });
  if (query.until != null) params.set("until", String(query.until));
  if (query.limit != null) params.set("limit", String(query.limit));
  const path = `/api/market-data/candles?${params}`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const body = await api.get<CandleColumns | { code: string; job_id?: string }>(path);
      if (isPreparing(body)) {
        await waitForJob(body.job_id);
        continue;
      }
      return candlesFromColumns(body as CandleColumns);
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_limited" && attempt < 3) {
        await sleep((error.retryAfterS ?? 10) * 1000);
        continue;
      }
      throw error;
    }
  }
  throw new ApiError("Market data is still being prepared.", 202, { code: "data_preparing" });
}

export function createCandleSource(symbol: string): CandleSource {
  return {
    history(timeframe, cutoffMs, bars) {
      const step = timeframeMs(timeframe);
      const start = Math.max(0, cutoffMs - bars * step);
      return loadCandles({ symbol, timeframe, start, end: cutoffMs, until: cutoffMs, limit: bars });
    },
    minutes(fromMs, toMs) {
      if (toMs <= fromMs) return Promise.resolve([]);
      return loadCandles({ symbol, timeframe: "1m", start: fromMs, end: toMs, until: toMs });
    },
  };
}
