# 01: Product and Architecture

## 1. Goals

Add three connected capabilities to the trading journal web app, all powered by market data the platform collects itself:

1. **Trade Replay.** Open any journaled trade and watch the market play out candle by candle, with entry, exit, stop loss and take profit drawn on the chart.
2. **Manual Backtesting (bar replay).** Pick a symbol and a start date, then trade the historical market by hand while it replays. Sessions are saved and resumable.
3. **Automated Backtesting.** Define a rule-based strategy through a form, run it over a historical range as a background job, and review metrics, equity curve and every trade, each with a link into the replay viewer.

## 2. Non-goals (do not build these)

- Users writing or uploading code strategies (security risk).
- Tick-level or order-book simulation.
- Real-time or live-trading data feeds.
- Stocks, futures or options data (only crypto, forex, metals, indices that Binance and Dukascopy cover).
- Multi-asset portfolio backtests or parameter optimization grids (leave extension points only).
- Copy trading, alerts, or paper-trading against live prices.
- Payment or subscription enforcement (build an entitlement hook only, see section 9).

## 3. User flows

### Flow A: Trade Replay
1. User opens a trade in the journal and clicks **Replay**.
2. App resolves the trade's symbol and times to canonical form. If data for the trade window is already stored, the replay page opens immediately. If not, the page shows a "Preparing market data" state with progress until the data job finishes.
3. The chart shows candles before the entry, a paused cursor at a configurable point before entry, and the trade overlays.
4. User plays, pauses, steps, changes speed, switches timeframe, scrubs, jumps to entry or exit, and can add a note at any moment.

### Flow B: Manual backtesting session
1. User opens Backtesting, chooses **New Session**: symbol, start date, initial balance, default timeframe, spread and commission settings.
2. Chart opens with history before the start date. The future is hidden.
3. User plays the replay, places market, limit and stop orders with SL and TP, closes positions, and sees balance, equity and statistics update live.
4. Session autosaves. User can leave and **resume** later exactly where they stopped, or finish the session to see a summary.

### Flow C: Automated backtest
1. User opens Backtesting, chooses **New Strategy**, builds entry and exit rules in a form, sets risk and cost assumptions, and picks symbol, timeframe and date range.
2. User saves the strategy and clicks **Run**. A background job starts; the UI shows status and progress.
3. On completion the results page shows KPI cards, equity curve, drawdown, monthly returns, distribution charts and a trades table. Each trade has **Open in Replay**.

### Flow D: Data preparation (invisible to users)
Data is prepared by pre-loaded history, lazy fetch on demand, prefetch after trade import or sync, and a nightly top-up. Users only ever see a loading state in rare first-time cases.

## 4. System architecture

Components and their single responsibilities:

| Component | Responsibility |
|---|---|
| **Instrument registry** | The list of supported instruments with canonical symbol, type, source, provider id, pip size, contract size, quote currency, price decimals |
| **Symbol resolver** | Maps a journal trade's broker and raw symbol to a canonical instrument, and normalizes trade timestamps to UTC |
| **Provider adapters** (Binance, Dukascopy) | Fetch raw 1-minute candles for a symbol and time range and return a normalized list. Nothing else |
| **Candle store** | Writes and reads Parquet partitions, tracks coverage, serves ranges through DuckDB |
| **Candle service** | The only way application code gets candles. Implements `ensure_candles`, aggregation to higher timeframes, caching |
| **Job system** | Database-backed queue and worker for ingestion jobs and backtest jobs, with per-provider concurrency limits and retries |
| **Scheduler** | Nightly top-up and periodic maintenance (an in-worker scheduler or a CLI command callable from cron) |
| **Replay API** | Produces trade-replay payloads and serves candle windows for the browser |
| **Session API** | Persists manual backtesting sessions, orders and trades |
| **Backtest API and engine** | Validates strategy JSON, runs the Python engine as a job, stores results |
| **Frontend chart component** | One reusable Lightweight Charts wrapper used by every viewer |
| **Frontend replay engine** | Pure TypeScript module: clock, speed, buffers, forming-candle logic, order engine for manual sessions |
| **Frontend pages** | Replay viewer, session simulator, strategy builder, results, optional data-status admin view |

Data flow in one sentence: **providers fill the candle store; the candle service reads it; the APIs expose windows of it; the browser replays it, and the Python engine backtests against it.**

## 5. Key design decisions and why

| Decision | Reason |
|---|---|
| Store only **1-minute candles** as the canonical dataset | Every higher timeframe is derived, so we store once and never keep per-timeframe copies |
| **Parquet + DuckDB** on local disk | No extra database server, tiny footprint (a few GB for 60 instruments over several years), fast range queries and aggregation, trivially portable to object storage later |
| **Database-backed job table**, no Redis | Fewer moving parts for a free-tier deployment; the same table runs ingestion and backtest jobs; swappable later |
| **Browser** runs replay and the manual order engine | Instant interaction, zero server cost per click |
| **Python** runs automated backtests | Full history access, heavier compute, protects the browser, one place to enforce limits |
| Strategies are **JSON, not code** | Safe to execute, easy to validate, easy to build a UI for |
| One written rules spec shared by both engines | Browser and Python must produce the same fills and stats. A shared scenario fixture suite enforces it |
| Providers behind adapters | Allows swapping Dukascopy or Binance for licensed sources without touching the app |

## 6. Scale budget: about 100 active users on free resources

Assumptions: one small server, one API process, one worker process, local disk storage, roughly 10 to 30 concurrent users at peak.

| Resource | Budget | Notes |
|---|---|---|
| Candle storage | Under 5 GB total | About 60 instruments, 4 to 8 years of 1m in compressed Parquet |
| Candle API response | Under 100 KB gzipped per request | Max 5,000 bars per call |
| Candle API latency | Under 300 ms at p95 for 2,000 bars when data is stored | Use caching |
| Automated backtest | Under 10 s for 100,000 bars with simple rules | Cap bars per run |
| Concurrency | 2 backtest jobs at once globally, 1 per user | Configurable |
| Ingestion | 1 Dukascopy job and 2 Binance jobs at once | Politeness limits |

**Configurable limits (defaults):** max bars per candle request 5,000; max bars per backtest run 500,000; max backtest runs per user per day 30; max concurrent backtests per user 1; max saved strategies per user 50; max manual sessions per user 50; max stored trades per backtest run 5,000; candle API requests per user per minute 120. All live in configuration, none hardcoded.

## 7. Cross-cutting requirements

- **Security:** all endpoints authenticated and user-scoped. Candle endpoints rate limited so the API cannot be used as a bulk data download. Never expose raw provider files.
- **Observability:** structured logs for every ingestion job, provider call and backtest run (duration, rows, outcome). A data-status view or endpoint shows coverage and recent failures.
- **Reliability:** all writes are atomic (write to a temporary file, then rename). Jobs retry with backoff and recover from crashes.
- **Time:** UTC internally. Daily candles align to 00:00 UTC in v1 (configurable constant, documented in the UI as "UTC daily candles").
- **Backtest vs live separation:** simulated trades live in their own tables and are never included in live journal statistics or the analytics page.

## 8. Licensing and risk notes (must be reflected in code and docs)

- Binance public market data: confirm terms of use for displaying candles to our own users. Display charts only; never offer raw data export.
- Dukascopy data is documented as for personal use. Keep the Dukascopy adapter behind a **feature flag** and a clearly named provider module so it can be replaced by a licensed source before the feature is monetized. Add a short `LICENSING_NOTES` section to the README stating this.
- TradingView Lightweight Charts requires an attribution notice. Include it in the chart UI footer area or the app's about/notice page as the library licence requires.

## 9. Entitlements hook

The app plans to charge for premium analytics later. Implement a single `feature access` check used by every new endpoint and page (for example `backtesting.replay`, `backtesting.manual`, `backtesting.automated`). For now it returns **allowed for everyone**, and limits come from configuration. A later subscription system should only need to change this one function.

## 10. Extension points to leave (document, do not build)

Additional providers, additional timeframes, parameter optimization, trailing stops and partial exits in the engine, multi-position strategies, exporting results to PDF, sharing a replay link.
