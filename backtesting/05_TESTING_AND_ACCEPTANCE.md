# 05: Testing and Acceptance

Everything here must pass against **real seeded data** before the feature counts as done. Write tests alongside each phase, not afterwards.

## 1. Seed dataset

The `seed-demo` command (document 02) loads **1 full calendar month** (choose a recent complete month) of 1-minute candles for **BTCUSDT**, **EURUSD** and **XAUUSD**. Used for manual QA, integration tests and the demo.

Expected sizes (sanity checks): a crypto month has about 43,000 to 44,640 one-minute candles; a forex month has about 28,000 to 32,000 (weekends absent). The data-status view must show these instruments covered for the whole month with no unexplained gaps.

## 2. Test fixtures

Keep small, **recorded** provider responses in test folders (never in shipped code):
- A Binance archive file in the millisecond timestamp format and another in the **microsecond** format, plus a checksum file, plus a corrupted copy.
- A Binance REST page response and a rate-limit (429) response.
- A Dukascopy tool output sample for one day, plus a malformed output sample.
- Hand-made candle series for engine scenarios (section 5).

## 3. Phase 1 tests: data foundation

**Unit**
- Candle validation: each rule accepts good data and rejects bad data with a clear reason.
- Binance parsing: both timestamp units normalize to the same milliseconds; checksum mismatch causes rejection.
- Dukascopy output parsing and rejection of malformed rows.
- Symbol resolver: alias hits, suffix stripping (for example broker-decorated names), separator handling, crypto perpetual naming, unresolved path with counter.
- Trade time normalization: trades from at least three timezone and server-offset situations resolve to the correct UTC and the entry price falls inside the entry candle on real seeded data.
- Coverage: gap detection, range merging, adjacent range merging, empty-range coverage.
- Aggregation: for 5m, 15m, 1h, 4h and 1d, compare DuckDB output against an **independent pure-Python calculation** on a random sample of buckets from the seed data; first open, max high, min low, last close and sum volume must match exactly; boundaries align to UTC; incomplete buckets are excluded.
- Storage: atomic write (simulate a crash between temp write and rename and verify the old file is intact), merge and deduplicate on rewrite, concurrent writer lock.
- Job system: dedupe key behaviour, retry with backoff, lock expiry recovery, cancellation between chunks, per-provider concurrency limits.

**Integration**
- `ensure_candles` with mocked providers: no gap returns instantly; small gap fetched inline; large gap enqueues exactly one job even with many concurrent callers; failed provider leaves coverage unchanged.
- Candle API: auth required, rate limiting works, limits enforced, response shape correct, gzip active, "preparing" response with job status polling.
- Idempotency: running the same backfill twice produces identical files and row counts.
- Nightly top-up: skipping a night then running fills the gap.

**Live smoke tests (run manually, clearly marked, not in default CI):** one real Binance fetch and one real Dukascopy fetch of a short recent range, verifying plausible prices (BTC and EURUSD within broad sanity ranges) and passing validation.

**Cross-check:** compare the stored BTCUSDT daily close for several days with Binance's daily klines, and EURUSD daily closes with a public daily reference; differences must be within a documented tolerance.

**Gate 1:** all above green; seed data present; data-status view accurate; one-month crypto and forex candles returned correctly at all timeframes through the API.

## 4. Phase 2 tests: Trade Replay

**Backend**
- Replay payload for trades of each duration class chooses the documented default timeframe and start.
- Price alignment diagnostic: a trade inside the candle gives no offset; a trade deliberately outside gives the correct offset suggestion.
- Unresolved symbol returns the stable error code and message.
- Prefetch hook: creating, importing and syncing trades each enqueue deduplicated jobs; a failure in the hook never blocks the trade save.
- Notes endpoints are user-scoped.

**Frontend (replay engine unit tests)**
- Forming-candle logic: merging 1-minute candles yields the same final candle as the server aggregate for 5m, 15m, 1h and 4h.
- Never renders data after the cursor: property-style test over random play, pause, seek and timeframe-switch sequences.
- Timeframe switch mid-bucket: partial candle correct, no future leakage, no duplicate candles.
- Buffer starvation pauses and resumes correctly.
- Step back and seek rebuild produce identical state to playing forward to the same time.
- Time-based loop catches up in bounded batches after a simulated throttled tab.

**Manual QA on real seeded trades (create journal trades that fall in the seeded month)**
1. Open a forex trade and a crypto trade, press Replay, confirm candles, markers, SL and TP lines appear at the right times and prices.
2. Play at each speed, pause, step forward and back, scrub, jump to entry and exit.
3. Switch timeframes at least five times mid-replay and confirm continuity.
4. Add a note, reload, confirm it persists and clicking it jumps to its time.
5. Use a trade outside seeded coverage and confirm the preparing state resolves and then replays.
6. Use an unresolvable symbol and confirm the clear message.
7. Check light and dark themes and a narrow window.

**Gate 2:** all above pass.

## 5. Phase 3 and 4 tests: engines (golden scenario suite)

Create a **shared scenario fixture format** (language neutral, such as JSON files in a shared test folder): input candles, instrument metadata, orders or strategy, costs, and the **expected fills, trades and statistics computed by hand**. Both the TypeScript manual engine and the Python engine must pass every scenario that applies to them. A failing disagreement between engines is a release blocker.

Mandatory scenarios:
1. Market buy fills at the next candle's open; SL hit later; correct loss in pips, R and money.
2. Market sell with TP hit; correct profit.
3. **Same candle hits both SL and TP:** the stop wins.
4. **Gap through stop:** fill at the open, not at the stop price.
5. **Gap through limit:** fill at the open when it is better than the limit.
6. Buy limit and sell limit triggers; buy stop and sell stop triggers; cancelled pending order.
7. Spread and commission effects on entry, exit and net profit; slippage on stop fills.
8. JPY pair and a metal: pip size and contract size produce the right pips and money; currency conversion with and without a conversion pair available (flagged warning case).
9. Trade with no stop loss: no R multiple, excluded from R statistics, flagged.
10. End of data: open position closed at the last close with reason "end of data" (automated engine) or "session end" (manual).
11. One position at a time: a second signal during an open trade is ignored.
12. Reverse on opposite signal: close before open, in order.
13. Session and weekday filters block entries correctly in UTC.
14. Warm-up: no signals before indicators are valid.

**Indicator tests:** SMA, EMA, RSI, MACD, ATR, Bollinger, Stochastic, ADX, highest high and lowest low checked against documented reference values on known inputs.

**Look-ahead test (mandatory):** run the same strategy on a series, then run it again on the same series with **all bars after bar N altered randomly**; every signal, fill and trade decision up to bar N must be identical.

**Metrics tests:** every metric verified against a hand-computed small trade list, including profit factor with no losses, expectancy in R, maximum drawdown with dates, streaks, and downsampling preserving the peak and trough of the equity curve.

**Job tests:** cancellation mid-run, time limit exceeded, bar cap exceeded, per-user concurrency limit, quota enforcement and reset, identical run returns cached result.

**Session server tests:** idempotent trade and order batches, validation rejects out-of-window and out-of-candle prices, recomputed values replace client values and discrepancies are flagged, finish is idempotent, delete cascades.

**Manual QA (Phase 3)**
1. Create a session on BTCUSDT and one on EURUSD, place market, limit and stop orders with SL and TP, watch them trigger.
2. Pause, reload the browser, resume, and confirm positions, orders, balance and chart continue exactly.
3. Confirm step back is disabled with open exposure.
4. Finish the session; the summary equals the server-recomputed stats; trades open in replay.
5. Confirm none of these trades appear in the live journal or analytics page.

**Manual QA (Phase 4)**
1. Build the three starter strategies, validate, save and run each over the seeded month (and a longer range once backfilled).
2. Watch queued, running and completed states, cancel one mid-run.
3. Check KPIs against a manual spreadsheet recomputation of the trades table for one run.
4. Open several trades in replay and confirm entry and exit markers match the table.
5. Trigger each validation error and each quota or limit error and confirm clear messages.

**Gates 3 and 4:** all above pass.

## 6. Phase 5 tests: hardening

- Rate limits and quotas configurable and effective; defaults match document 01.
- Candle cache: repeat requests faster; current-month cache invalidated after a top-up.
- Worker crash drill: kill the worker mid-ingestion and mid-backtest; on restart, jobs recover without corrupt files or duplicate rows.
- Provider failure drills: Binance 429, 418 and 451; Dukascopy tool failure; disk full simulation. Each yields the documented behaviour and UI state.
- Health endpoint reports each dependency correctly, including a stale worker heartbeat.
- Data-status page reflects coverage, gaps and failures accurately and the retry button works.
- Log review: every ingestion job and backtest produces a structured log line.
- Fresh-checkout test: follow README exactly on a clean clone, migrate, seed, start API, worker and frontend, and use each feature.

## 7. Performance targets (measure and record in the final report)

| Measure | Target |
|---|---|
| Candle API, 2,000 bars, data stored, p95 | Under 300 ms |
| Candle API response size, 2,000 bars | Under 100 KB gzipped |
| Replay at 10x and 50x | Smooth, no dropped-frame stutter, no growing memory over 10 minutes |
| Timeframe switch | Under 1 second on seeded data |
| Backtest, 100,000 bars, simple rules | Under 10 seconds |
| Backtest, 500,000 bars | Completes or fails cleanly within the time limit |
| Worker idle resource use | Negligible CPU |
| 20 concurrent simulated users on candle API | No errors, p95 within 2x target |

## 8. Final acceptance criteria (all must be true)

1. A user can open any resolvable journal trade and replay it with correct overlays, controls and timeframe switching, with no future-data leakage.
2. A trade whose data is not yet stored becomes replayable automatically with a visible preparing state, without the user doing anything.
3. A user can run, pause, resume and finish manual sessions, with server-verified statistics and no contamination of live analytics.
4. A user can build, save, validate and run a strategy as a background job, see progress, cancel, and review correct metrics, equity, drawdown, breakdowns and every trade, each openable in replay.
5. The browser and Python engines agree on every golden scenario.
6. The look-ahead test passes for all supported indicators.
7. Binance and Dukascopy ingestion work live, are idempotent, resumable and rate limited; seed and top-up commands work; coverage is accurate.
8. Unresolvable symbols, provider outages, quotas and rate limits produce the documented errors and UI states.
9. All limits are configuration values with documented defaults; no secrets in code; `.env.example` complete.
10. Existing app features and tests still pass; backtest data never appears in live analytics.
11. The README lets a new developer set up, seed, run and test from scratch.
12. Licensing notes and the chart library attribution are present.

## 9. Final report (Cursor must produce this at the end)

Write `docs/backtesting/FINAL_REPORT.md` containing:

- What was built, per phase, with the main files and modules.
- The result of every gate and test suite (counts and pass status), and results of the manual QA steps actually performed.
- Measured performance numbers against the targets.
- Seeded data summary (instruments, ranges, sizes) and backfill instructions for the full seed list.
- All configuration values and their defaults.
- Decisions and deviations (link to DECISIONS.md).
- Known gaps, risks and recommended next steps, stated plainly. Include licensing follow-ups for Dukascopy and Binance before monetization.
- Exact commands to start the API, worker, scheduler and frontend and to run the tests.
