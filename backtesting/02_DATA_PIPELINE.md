# 02: Data Pipeline

Everything about getting market data into the platform and out to the rest of the app.

## 1. Canonical candle

Every candle in the system has exactly these fields: **timestamp** (UTC, start of the 1-minute bar, stored as epoch milliseconds), **open, high, low, close** (floating point), and **volume** (floating point, may be absent or unreliable for forex). Prices are stored as provided by the source. Source name and instrument are implied by the file location.

Rules every stored candle must satisfy: high is at least the maximum of open and close, low is at most the minimum of open and close, all prices positive, timestamp aligned to the minute, no duplicate timestamps per instrument.

## 2. Instrument registry

A configuration file (YAML or JSON, loaded and validated at startup, mirrored into a database table) that lists every supported instrument. Fields per instrument:

| Field | Meaning |
|---|---|
| canonical symbol | The internal name, e.g. EURUSD, XAUUSD, BTCUSDT |
| asset class | forex, metal, index, crypto |
| source | binance or dukascopy |
| provider id | The identifier the provider uses (Binance symbol, Dukascopy instrument id) |
| market type | For Binance: spot or USD-margined futures |
| pip size | The price increment treated as one pip (or one point for indices and crypto) |
| contract size | Units per 1.0 lot for forex and metals, or 1 for crypto |
| quote currency | The currency profits are denominated in |
| price decimals | For display |
| enabled | Whether ingestion and the UI offer it |
| preload years | How much history the seed command should fetch by default |

**Seed list** (verify each provider id against the provider before enabling, do not guess):

- Forex majors and crosses: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD, EURGBP, EURJPY, GBPJPY, AUDJPY, EURAUD.
- Metals: XAUUSD, XAGUSD.
- Indices: the US 500, US Tech 100, US 30 and Germany 40 equivalents that Dukascopy actually offers. Discover the exact ids through the Dukascopy tool's instrument list.
- Crypto: BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, LINKUSDT, AVAXUSDT, TRXUSDT, plus USDT-margined futures for BTC and ETH.

Adding an instrument must require only a registry entry, then a backfill command. No code change.

## 3. Symbol resolution and time normalization

### 3.1 Resolving a journal trade to an instrument

Input: the trade's broker name and raw symbol. Output: a canonical instrument or "unresolved".

Resolution order:
1. Exact match in an **alias table** (broker, raw symbol → canonical). Seed it with known cases.
2. **Suffix and prefix rules** applied to the raw symbol: strip common broker decorations such as trailing m, .m, #, .pro, .raw, .a, ., and similar; handle separators like EUR/USD or EUR_USD; uppercase.
3. For crypto: strip separators, map perpetual naming (for example BTCUSDT.P, BTC-USDT-SWAP, BTCUSD_PERP) to the correct canonical instrument and market type.
4. If still unmatched, mark the trade **unresolved**, store the (broker, raw symbol) pair in an `unresolved_symbols` table with a counter, and make the replay UI show a clear "Replay isn't available for this symbol yet" message.

Provide an internal way to add alias rows (a small admin endpoint or a CLI command) and a report listing the most common unresolved symbols.

### 3.2 Which source for a crypto trade

If the trade's broker is Binance, use Binance. If it is another crypto exchange (Bybit, OKX, Bitget), v1 uses Binance data for the same pair and shows a note that prices come from Binance and may differ slightly. Record this in DECISIONS.md.

### 3.3 Trade timestamps (critical)

Journal trades may have been saved in the user's local time, in broker server time, or in UTC. The audit (Phase 0) must find out exactly what the app stores. Then:

- Convert every trade time to UTC inside the resolver using the stored timezone information.
- If trades carry broker server time with no explicit offset, add a **per-broker server UTC offset setting** (with DST handling for brokers that follow New York close time) and document the defaults.
- Write tests with trades from different brokers and verify the entry candle contains the entry price.

## 4. Storage layout

Local directory (path from configuration) organized as:

- A top-level candles folder, then source, then canonical symbol, then year, then month.
- Inside each month folder, a single sorted Parquet file for that month, compressed with zstd.
- A temporary-files folder for in-progress writes, on the same filesystem so renames are atomic.

Rules:
- A month file is **rewritten as a whole** whenever new data for that month arrives (months are small). The rewrite merges existing and new rows, removes duplicates by timestamp, sorts, writes to a temp file, then atomically renames over the old one.
- Writes for the same instrument and month are serialized with a lock so two jobs never corrupt a file.
- A **storage abstraction** (interface) hides the filesystem. Provide a local-disk implementation now. Document how an S3-compatible implementation would plug in later.

## 5. Coverage tracking

A database table records, per instrument and source, the contiguous time ranges that are **fully fetched** (start, end, last updated, row count). Coverage means "we asked the provider for this range and stored what it had", so legitimately empty periods (weekends, holidays) count as covered.

Operations needed: find the **gaps** between a requested range and current coverage; mark a range as covered; merge adjacent ranges. Coverage changes only after the corresponding data files are safely written.

## 6. Binance adapter

Two ingestion modes:

**Bulk mode (historical backfill).**
- Download monthly archive files for full past months and daily archive files for the current month, for the right market type (spot or USD-margined futures). The public archive host is the Binance public data site.
- Download the accompanying checksum file and **verify the checksum** before parsing. Failed verification means discard and retry.
- The archive CSV has no header. The first six columns are open time, open, high, low, close, volume. Ignore the rest.
- **Timestamp unit warning:** Binance changed spot archive timestamps from milliseconds to microseconds in 2025. Detect the unit by magnitude (13 digits means milliseconds, 16 digits means microseconds) and normalize to milliseconds. Cover this with a test using both formats.
- Missing archive files (HTTP 404) for a given day are normal for very recent days or newly listed pairs. Fall back to REST for those ranges.

**REST mode (recent data and gap fill).**
- Use the public klines endpoint with 1-minute interval, requesting up to the maximum page size and paging forward by start time until the end of the range.
- Respect rate limits: read the usage headers, sleep proactively, and back off with jitter on 429 and 418 responses. Honour any retry-after instruction.
- If a region block (HTTP 451) occurs, try the alternate public market-data host and then fail the job with a clear error message.
- Never request the still-forming current minute as final data. Only keep fully closed candles.

## 7. Dukascopy adapter

- Use the **dukascopy-node** command-line tool as the downloader, invoked as a subprocess from the worker, requesting **1-minute candles**, **UTC timestamps**, **BID prices** by default (make the price side a configuration value), and **without flat (empty) candles** so market-closed periods stay absent. Pin its version in a lockfile.
- At environment check time, confirm Node.js is available. If it is not, document this clearly and either add Node to the setup instructions or implement a Python decoder. Record the choice in DECISIONS.md.
- Convert the tool output to the canonical candle form. Reject output that fails the candle rules in section 1 and log the reason.
- Fetch in **chunks of about one week** for 1-minute data, politely paced, one Dukascopy job at a time. Retry with backoff. A chunk that fails after retries fails the job without marking its range as covered.
- Volume from Dukascopy forex is not comparable to real volume. Store it but never use it in indicators or the UI by default.
- Keep this adapter behind the feature flag and licensing note from document 01.

**Amended by D-040 and D-041 (F4):** one probe request runs before the tool. A challenge or HTTP 202 sets `provider_blocked` and a cool-down (`DUKASCOPY_BLOCK_COOLDOWN_S`, default 6 hours) with no retry loop. The file importer (`import-candles`, admin upload) is the supported way to load Dukascopy or HistData files on a blocked network. An instrument is enabled only after `verify-instrument --stored` passes (D-042).

## 8. Validation and quality checks

Run on every batch before it is written:

1. Candle rules from section 1.
2. Timestamps strictly increasing and minute aligned after sorting.
3. Duplicate handling (keep the later fetch).
4. Outlier detection: flag any candle whose range exceeds a configurable multiple of the recent median range, log it, but keep it.
5. Gap report: list missing minutes **inside open-market periods** (for forex, outside the weekend closure; for crypto, any missing minute). Store a gap summary per instrument month for the data-status view.

A **daily cross-check job** (optional but included in Phase 5) compares each instrument's most recent complete daily close from stored data with an independent reference (Binance daily klines for crypto, a free daily reference source for forex) and logs differences above a tolerance.

**Amended by D-043 (F5):** crypto high, low, and close are compared with Binance daily klines. Forex uses the ECB reference at 14:10 Europe/Berlin, with a wider tolerance. Metals are `no_reference`. Results are stored in `crosscheck_results` and shown on the admin data-status page. One instrument failing does not fail the job.

## 9. The candle service

This is the only module the rest of the app uses to get candles.

### 9.1 ensure_candles
Input: instrument, start, end. Behaviour:
1. Compute gaps between the request and coverage.
2. If no gaps, return immediately.
3. If gaps exist and the missing span is **small** (default under 3 days of 1-minute data), fetch it **inline** with a time limit (default 20 seconds). On success, return normally.
4. If the missing span is larger, or the inline attempt exceeds the limit, **enqueue an ingestion job** (deduplicated) and report "preparing" with the job id.

Concurrent requests for the same missing range must share one job, not create several.

**Amended by D-017 (implemented in 1G):**

- Dukascopy gaps always become a job.
- Inline fills are Binance REST only, for gaps up to `INLINE_FETCH_MAX_GAP_MINUTES` (4,320), with a timeout of `INLINE_FETCH_TIMEOUT_S` (8 s).
- At most `INLINE_FETCH_MAX_CONCURRENT` (4) inline fills run per process.
- Over the cap, on timeout, or on a retryable provider error, the request gets a deduplicated job (day-aligned dedup key) and a "preparing" answer.
- Sync request handlers must never block the threadpool for long.

### 9.2 get_candles
Input: instrument, timeframe, start, end (or limit with an anchor and direction), optional "until" cutoff. Output: columnar arrays of time, open, high, low, close, volume.

- 1-minute requests read directly from the store.
- Higher timeframes are **aggregated from 1-minute data in DuckDB**: first open, maximum high, minimum low, last close, summed volume per bucket, with buckets aligned to UTC epoch boundaries (daily aligned to 00:00 UTC; weekly aligned to Monday 00:00 UTC if weekly is offered).
- Supported timeframes: 1m, 5m, 15m, 30m, 1h, 4h, 1d.
- **Completeness rule:** a bucket is returned as a candle only if it is fully closed relative to the "until" cutoff (or relative to now when no cutoff is given). The in-progress bucket is never returned as final.
- Hard limit on bars per request from configuration. Responses state whether more data exists before or after.
- An **in-memory LRU cache** (bounded size) keyed by instrument, timeframe and range holds recent aggregated windows. Historical data is immutable, so cached entries stay valid; the current month's cache entries are invalidated when a top-up writes to that month.
- Strategy runs call this service for the strategy timeframe. They request the date range plus the warm-up bars, in chunks no larger than the per-request bar cap, and concatenate them.

## 10. Job system

One `jobs` table serves ingestion and backtests. Fields: id, type, status (queued, running, succeeded, failed, cancelled), payload, deduplication key (unique while the job is active), progress percentage and message, attempts, max attempts, next run time, locked by and locked until (for crash recovery), error message, created, started, finished, owner user (for backtests).

Worker behaviour:
- A separate worker process (entry command documented in the README) polls for runnable jobs.
- Per-type and per-provider **concurrency limits** from configuration (defaults in document 01).
- A **global rate limiter per provider** so concurrent jobs together stay polite.
- Retries with exponential backoff and jitter up to max attempts, then fail with a readable error.
- **Crash recovery:** a job whose lock has expired is returned to the queue.
- Progress is updated at meaningful steps (for example, per month downloaded) so the UI can show it.
- Jobs can be cancelled; the worker checks cancellation between chunks.

## 11. Prefetch on trade events

Whenever trades are created, imported, or synced (manual add, file import, broker sync): for each new trade that resolves to an instrument, enqueue an ingestion job for the **replay window** (default from 200 bars of the default timeframe before entry to 100 bars after exit, expressed in 1-minute data and padded by a day). Deduplicate against existing coverage and active jobs. Unresolved trades only log to the unresolved table. This hook must never block or fail the user's trade save: failures are logged and swallowed.

## 12. Nightly top-up

A command (and an optional in-worker scheduler) that, for every enabled instrument, fetches from the last covered time up to the last fully closed day (UTC). Behaviour:
- Runs at a configured UTC hour (default shortly after 00:30 UTC so Binance daily files exist; REST covers any gap).
- Processes instruments sequentially with the global rate limiter.
- Writes a summary log: instruments updated, candles added, failures.
- Is safe to run twice, and safe to skip a night (the next run fills the gap).

## 13. Backfill and seed CLI

Provide one CLI entry point with these commands (names are indicative; follow the project's CLI conventions):

| Command | Purpose |
|---|---|
| seed-demo | Backfill a small demo dataset: 1 month for BTCUSDT, EURUSD and XAUUSD. Used by tests and QA |
| backfill | Backfill one instrument or all enabled instruments for a given range, or for their configured preload years |
| top-up | Run the nightly top-up now |
| coverage | Print coverage and gaps per instrument |
| verify | Re-run validation on stored files and report problems |
| add-alias | Add a broker symbol alias |
| unresolved | List most common unresolved broker symbols |

All commands are resumable and respect the same rate limits. The first full backfill of the seed list should be run in the background over hours or days; the README explains how to start it and how to watch progress.

## 14. Data-status view

A protected admin endpoint and a simple admin page listing: each instrument, source, covered range, last update, gap summary, and the most recent failed jobs with error messages and a retry button. This is what the crawling and QA team will use to test and operate the pipeline.

## 15. Error behaviour summary

| Situation | Behaviour |
|---|---|
| Provider unreachable or rate limited | Retry with backoff; job fails after max attempts with a readable message; the UI shows "market data temporarily unavailable" |
| Corrupt or invalid batch | Reject the batch, log details, do not mark covered |
| Symbol unresolved | No job; UI explains replay is unavailable for this symbol |
| Data not ready | API reports preparing with job id; UI polls and shows progress |
| Requested range before the instrument's first available data | Return what exists plus a flag stating the earliest available time |
| Disk write failure | Job fails; temp files cleaned; error logged |

## 16. Acceptance for this document

Covered by document 05, Phase 1 gate: seeded data present, aggregation correct against independent calculations, coverage and idempotency verified, both adapters tested with recorded fixtures and one live smoke test each, job recovery tested.
