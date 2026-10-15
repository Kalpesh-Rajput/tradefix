# 03: Backend API and Engines

Defines the database entities, the API contract, the shared trading rules, the manual-session server logic, and the automated backtest engine. The **trading rules in section 5 are the single source of truth** for both the browser engine and the Python engine.

## 1. API conventions

- Follow the existing app's auth, routing prefix, error format and pagination style. Every endpoint is authenticated and scoped to the current user. Admin endpoints require the existing admin role or flag.
- Every endpoint first calls the **feature access check** (document 01, section 9).
- Candle data travels as **columnar arrays** (one array per field) and is gzip compressed.
- Timestamps in all API payloads are **epoch milliseconds in UTC**. Dates in requests may be ISO 8601 UTC.
- Errors use stable machine codes in addition to messages. The code list is in section 10.
- Long operations return an accepted response with a job id and are polled.

## 2. Database entities

All new tables use the project's migration tool. All user-owned rows carry the owner user id and are indexed by it.

| Entity | Key fields |
|---|---|
| **instruments** | Mirror of the registry (canonical symbol, asset class, source, provider id, market type, pip size, contract size, quote currency, decimals, enabled) |
| **symbol_aliases** | broker, raw symbol, canonical symbol, created by |
| **unresolved_symbols** | broker, raw symbol, count, first seen, last seen |
| **candle_coverage** | instrument, source, covered from, covered to, row count, updated at |
| **jobs** | As described in document 02, section 10 |
| **backtest_sessions** | id, user, instrument, default timeframe, start time, end time limit (optional), cursor time (current replay time), initial balance, account currency, spread (in pips or points), commission per lot, status (active, finished), notes, created, updated |
| **session_orders** | id, session, side, type (market, limit, stop), size, price (for pending), sl, tp, status (pending, filled, cancelled, rejected), created at (replay time), filled at |
| **session_trades** | id, session, side, size, entry time, entry price, exit time, exit price, sl, tp, exit reason (tp, sl, manual, session end), commission, pnl, pips, r multiple, notes |
| **strategies** | id, user, name, description, definition (the strategy JSON), schema version, created, updated |
| **backtest_runs** | id, user, strategy id, strategy snapshot (copy of JSON used), instrument, timeframe, range, status, job id, started, finished, duration, bars processed, metrics (structured), equity curve (downsampled series), drawdown series, monthly returns, breakdowns, warnings, error message, result hash |
| **backtest_run_trades** | id, run, sequence number, side, entry time, entry price, exit time, exit price, size, sl, tp, exit reason, pnl, pips, r multiple, bars held, mae, mfe |
| **trade_replay_notes** | id, user, journal trade id, replay time, text, created |
| **usage_counters** | user, day, backtest runs, manual sessions created (for quotas) |

Separation rule: **session_trades and backtest_run_trades are never joined into the live trades table or live analytics.** If the user chooses "save to journal", create a journal entry explicitly tagged as simulated and excluded from live statistics (design this as an opt-in flag the existing analytics code filters on; document the filter in DECISIONS.md).

## 3. Endpoints

### 3.1 Data and candles

| Method and path (indicative) | Purpose |
|---|---|
| GET instruments | List enabled instruments with metadata for pickers; supports search by symbol or asset class |
| GET candles | Query: instrument, timeframe, start and end, or an anchor with direction and limit, optional until cutoff. Returns columnar candles plus metadata (earliest and latest available, has more before, has more after). Returns an "accepted" style response with job id and progress when data is still being prepared |
| GET data-jobs/{id} | Job status and progress for data preparation |

### 3.2 Trade Replay

| Method and path | Purpose |
|---|---|
| GET trades/{id}/replay | Resolve the journal trade and return the **replay payload**: resolved instrument, trade summary (side, size, entry time and price, exit time and price, SL, TP, fees), suggested start time, default timeframe, a price-alignment diagnostic, and either "ready" or "preparing" with job id |
| POST trades/{id}/replay-notes and GET same | Add and list notes pinned to replay times |

**Replay payload rules:**
- Default timeframe: chosen from the trade's holding duration (under 2 hours: 1m or 5m; under 1 day: 15m; under 1 week: 1h; longer: 4h).
- Suggested start: enough bars before entry to show context (default 100 bars of the default timeframe).
- **Price alignment diagnostic:** compare the trade's entry price (and exit price) against the 1-minute candle containing that time. If outside the candle's high and low by more than a tolerance (default 0.05 percent, or 2 pips for forex), return an `offset_suggestion` containing the difference, so the UI can warn and offer an optional display-only alignment.
- If the instrument is unresolved, return the stable error code for unresolved symbols with a user-readable message.

### 3.3 Manual backtesting sessions

| Method and path | Purpose |
|---|---|
| POST sessions | Create a session (validates instrument, start date within available data, balance, costs); enforces quota |
| GET sessions | List the user's sessions with summary stats |
| GET sessions/{id} | Full session state: settings, cursor time, open orders, open positions, closed trades, running stats |
| PUT sessions/{id}/state | Persist cursor time and in-flight state (autosave, idempotent) |
| POST sessions/{id}/trades | Append closed trades and fills (batch, idempotent by client-generated ids) |
| POST sessions/{id}/orders | Persist order lifecycle changes (batch, idempotent) |
| POST sessions/{id}/finish | Mark finished, recompute stats server-side, return summary |
| DELETE sessions/{id} | Delete the session and its children |
| GET candles (replay chunks) | Same candle endpoint, used by the browser to fetch 1-minute chunks ahead of the cursor |

**Server responsibilities for sessions:** validate that every trade's times fall within the session's replay window and that prices lie within the 1-minute candle range at those times (with the small tolerance); recompute pnl, pips and R multiple from entry, exit, size and instrument metadata using the shared rules; store the recomputed values; flag discrepancies from client-reported values in the session warnings. This is sanity validation, not anti-cheat.

### 3.4 Automated backtesting

| Method and path | Purpose |
|---|---|
| POST strategies, GET strategies, GET strategies/{id}, PUT strategies/{id}, DELETE strategies/{id} | CRUD for saved strategies; definitions are validated against the schema on every write |
| POST strategies/validate | Validate a definition without saving; returns field-level errors and the estimated number of bars |
| POST backtests | Start a run (strategy id or inline definition plus overrides for range). Validates, enforces quotas and limits, snapshots the definition, creates the job, returns run id and job id |
| GET backtests | List runs with headline metrics |
| GET backtests/{id} | Status, progress, and (when finished) the full result |
| GET backtests/{id}/trades | Paginated trades with sorting and filters (winners, losers, side, date) |
| POST backtests/{id}/cancel | Cancel a queued or running run |
| DELETE backtests/{id} | Delete a run |

### 3.5 Admin and operations

| Method and path | Purpose |
|---|---|
| GET admin/data-status | Coverage, gaps, last updates per instrument; recent failed jobs |
| POST admin/data-jobs | Enqueue a backfill or top-up for an instrument and range |
| POST admin/data-jobs/{id}/retry | Retry a failed job |
| GET and POST admin/symbol-aliases, GET admin/unresolved-symbols | Alias management |
| GET health | Liveness plus checks: database reachable, storage path writable, worker heartbeat recent |

## 4. Instrument math (shared by both engines)

- **Pip or point value** comes from the registry. For forex, one pip is the registry's pip size (for example 0.0001, or 0.01 for JPY pairs). For metals, indices and crypto the registry's "pip" is the unit the app displays as points.
- **Position size** is expressed in lots for forex and metals (units = lots × contract size) and in base-asset units for crypto.
- **Profit** in quote currency equals direction (+1 buy, -1 sell) × (exit price − entry price) × units, minus commission and costs.
- **Account currency** defaults to USD. For instruments whose quote currency is USD (or USDT for crypto) profit converts one to one. For other quote currencies (for example JPY, CHF, CAD), convert using the same instrument family's USD pair price **at the exit time from stored data**; if the conversion pair is unavailable, report profit in quote currency with a flagged warning and still compute **pips and R multiple**, which are currency independent. R multiple and pips are the primary performance units; money values are secondary.
- **R multiple** equals profit in price terms divided by the initial risk in price terms (distance from entry to the original stop loss). Trades without a stop loss have no R multiple and are excluded from R-based statistics (flagged).
- **Costs:** spread (in pips) is applied by buying at the ask and selling at the bid, modelled as half the spread against the trader on entry and half on exit relative to the candle's BID price series. Commission is per lot, per side, in account currency. Optional slippage in pips applies to stop and market fills in the adverse direction.

## 5. Trading rules (the single source of truth)

Both engines implement exactly these rules, and shared scenario fixtures (document 05) verify they agree.

### 5.1 Processing order within each 1-minute candle (manual engine) or each bar (automated engine)

1. Check pending orders for triggering.
2. Check open positions for stop loss and take profit hits.
3. Apply closes requested at this bar.
4. Update equity and statistics.

### 5.2 Fills

- **Market orders** fill at the **next candle's open** after the order is placed (in the manual engine the order placed while paused fills at the open of the next replayed 1-minute candle).
- **Buy limit** triggers when the candle's low is at or below the limit price; fills at the limit price, or at the open if the candle opens below it (gap through). **Sell limit** mirrors this with highs.
- **Buy stop** triggers when the high is at or above the stop price; fills at the stop price, or at the open if it gaps above. **Sell stop** mirrors this with lows. Apply slippage to stop fills.
- **Stop loss and take profit** for a long: stop triggers when low is at or below the stop; take profit when high is at or above the target. For a short, reversed. Gaps fill at the open when the open is already beyond the level.
- **Same candle ambiguity:** if one candle could have hit both the stop and the target, **assume the stop was hit first** (documented conservative rule), unless the engine is later given lower-timeframe data to resolve the order (extension point, not built).
- **Entry and exit in the same candle:** an order that fills at a candle's open may have its SL or TP hit within that same candle, using the same ambiguity rule.

### 5.3 Rules specific to automated backtests

- Signals are evaluated only on **closed bars**; the resulting order fills at the **open of the next bar**. Indicator values at bar i use data up to and including bar i only.
- One open position at a time in v1. A new entry signal while a position is open is ignored (unless the strategy defines "reverse on opposite signal", in which case close and open in the correct order).
- No signal is evaluated until all indicators have enough warm-up bars; the warm-up count is the longest lookback used.
- At the end of the range, any open position is closed at the last bar's close with exit reason "end of data".
- Session filters and weekday filters use UTC.
- The worker loads stored candles for the requested range plus the warm-up lookback (`bar_loader.py`), in chunks of `CANDLE_MAX_BARS_PER_REQUEST`. Warm-up bars are stepped so indicators are valid, and they cannot open a trade (`trade_start_index`).
- If that 1-minute range is not covered, the run status is `waiting_data` until the ingest job finishes (D-033). A short series fails with `insufficient_data` (D-035). It is not a successful empty run.

## 6. Manual session logic (browser plus server)

- The **browser engine** is interactive and authoritative for the live feel: it processes each replayed 1-minute candle under the rules above and emits fills and closes. It batches persistence to the server (autosave at intervals, on pause, on tab hide, and on finish).
- The server **persists and verifies** (section 3.3) and recomputes the final statistics on finish.
- **Resume:** the session state returns the cursor time, open positions and pending orders; the browser reconstructs the chart (history at the chosen timeframe up to the cursor, plus a partial current candle built from 1-minute data) and continues.
- **Statistics shown live and on finish:** balance, equity, floating profit, closed trade count, win rate, average R, profit factor, expectancy in R, maximum drawdown, best and worst trade, plus a per-trade list.

## 7. Strategy definition (JSON, versioned)

The schema version is part of every definition. Validation is strict: unknown fields rejected, numeric bounds enforced.

| Section | Contents |
|---|---|
| **identity** | name, description, schema version |
| **market** | instrument, timeframe, start date, end date |
| **direction** | long only, short only, or both |
| **entry** | One rule set for long and one for short (when both). A rule set is a group combining conditions with "all" or "any", and groups may nest one level |
| **condition** | left operand, operator, right operand. Operands are: a price field (open, high, low, close) with optional offset in bars (0 is the current closed bar, 1 is the previous), an indicator with its parameters and which output line, or a numeric constant. Operators: greater than, less than, greater or equal, less or equal, crosses above, crosses below |
| **stop loss** | type (fixed pips or points, multiple of ATR, percent of price, or at a recent swing low/high over N bars), value, and parameters |
| **take profit** | type (multiple of the initial risk, fixed pips or points, multiple of ATR), value |
| **optional exits** | maximum bars in trade, exit on opposite signal, exit when an exit rule set becomes true |
| **filters** | allowed UTC hours, allowed weekdays, maximum trades per day, minimum bars between trades |
| **risk** | initial balance, risk percent per trade or fixed lot size, maximum position size |
| **costs** | spread in pips, commission per lot per side, slippage in pips |

**Validation limits (configurable):** at most 10 conditions per entry rule set, at most 6 distinct indicators, indicator periods between 2 and 500, estimated bars not above the per-run cap. A range that is not stored yet is allowed: validate reports `data_ready: false` and the run prepares the data (D-034).

## 8. Indicators (implement ourselves, with unit tests)

SMA, EMA, RSI (Wilder smoothing), MACD (line, signal, histogram), ATR (Wilder), Bollinger Bands (middle, upper, lower, with standard deviation multiple), Stochastic (%K, %D), ADX (with +DI and -DI), plus highest high and lowest low over N bars. Each indicator's output must match reference values (documented known inputs and outputs in the tests). No indicator may use future bars. Use vectorized array operations for speed. Do not add an indicator library dependency unless it is already in the project.

## 9. The Python engine

- **Input:** validated definition, candles aggregated to the strategy timeframe for the range plus the warm-up period, instrument metadata.
- **Process:** compute all indicator series once; evaluate entry conditions as boolean series over closed bars; then run an **event loop** over bars that applies section 5 for fills, SL/TP, filters, sizing and costs. Track equity at every bar close.
- **Output:** trades (with MAE and MFE in pips and R), equity curve, drawdown series, and the metrics below.
- **Execution:** inside a job. The worker checks cancellation periodically, enforces a **wall-clock time limit** (configurable, default 120 seconds) and a bar cap, updates progress (data loading, indicators, simulation) and writes results in one transaction.
- **Determinism and caching:** results depend only on the definition and the data version. Compute a **result hash** from the definition and the coverage version of the candles used (D-036); if an identical successful run exists for the same user within a configured window, copy that result instead of recomputing. The copy includes metrics (with weekday, hour, month, R and drawdown breakdowns), equity, warnings, skip counts, and the stored trade rows (`INSERT ... SELECT`, capped at `BACKTEST_MAX_TRADES_PER_RUN`). It sets `served_from_cache` and `cached_from_run_id`. Deleting the source sets that reference to null and leaves the copy’s trades in place. `force_fresh: true` skips the lookup. A cache hit still counts as a run (D-037). The finished run records `first_bar_ms`, `last_bar_ms` and `coverage_version`.

### Metrics

Net profit, return percent, number of trades, win rate, average win, average loss, payoff ratio, profit factor, expectancy in R, average R per trade, maximum drawdown (absolute and percent) with dates, longest winning and losing streaks, average bars held, exposure percent, best and worst trade, a Sharpe-like ratio computed on daily returns (label it clearly as indicative), trades per month, and breakdowns by weekday, by UTC hour and by month. **Warnings** are attached to the result: fewer than 30 trades; very high win rate with very few trades; spread and slippage set to zero; range shorter than 3 months; and "past performance does not predict future results".

**Equity curve storage:** store the full-resolution series in memory during the run, then downsample to a maximum number of points (default 1,000, using min/max preserving downsampling) before saving.

## 10. Stable error codes

| Code | Meaning | Typical HTTP status |
|---|---|---|
| unresolved_symbol | Trade symbol cannot be mapped to a supported instrument | 422 |
| instrument_not_supported | Instrument not in registry or disabled | 422 |
| data_preparing | Data is being fetched; poll the job | 202 |
| data_unavailable | Provider failure after retries, the data wait expired, or no data exists for the range | 503 or 404 |
| insufficient_data | The loaded series is shorter than the warm-up plus the minimum bar count | 422 |
| range_outside_available_data | Requested range starts before earliest data | 422 |
| limit_exceeded | Too many bars requested or backtest bars cap hit | 422 |
| quota_exceeded | Daily or concurrent quota hit | 429 |
| rate_limited | Too many requests | 429 |
| invalid_strategy | Definition failed validation; field-level details included | 422 |
| job_failed | Background job failed; message included | 500 |
| job_cancelled | Run was cancelled | 409 |
| feature_not_allowed | Entitlement check denied | 403 |
| not_found | Resource missing or not owned by user | 404 |

## 11. Performance and safety requirements

- Candle queries always have an enforced maximum range and bar count.
- Database queries for lists are paginated and use indexes on owner and created time.
- Backtest jobs cannot read other users' data and cannot exceed the time and bar limits.
- All user-provided strings (names, notes) are length-limited and sanitized on output.
- Structured logs record each backtest (user, instrument, bars, duration, outcome) and each ingestion job.
