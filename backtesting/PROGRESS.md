# Backtesting: Progress (resume file)

Read this first in every new context window, then `DECISIONS.md`, `AUDIT.md`, and the current sub-phase in `PLAN.md`.

## Current state

- **Plan revision:** 2 (rev 1 had 15 sub-phases; rev 2 has 32; see D-014).
- **Current sub-phase:** 2F (replay page shell).
- **Blocked on:** nothing.
- **Last commit:** see the commit log below.

## Sub-phase checklist

Status values: `todo`, `in-progress`, `auto-passed` (all [AUTO] checks run and passed), `done` (auto-passed and all [NET] and [HUMAN] items verified).

| Id | Scope | Status |
|---|---|---|
| 0 | Audit and docs | auto-passed (node v24.21.0, Postgres 18.6 at 0032 verified) |
| 1A | Schema, config, registry | auto-passed |
| 1B | Live-trades helper: core journal readers | auto-passed |
| 1C | Live-trades helper: AI, sync, import, raw-SQL readers | auto-passed |
| 1D | Resolver, validation, store, coverage | auto-passed |
| 1E | Provider adapters, verify-instrument | auto-passed (1 NET pending) |
| 1F | Jobs queue, worker, entitlements, errors, make-admin | auto-passed |
| 1G | Candle service core | auto-passed |
| 1H | Candle API, health, gzip, CLI, seed (Gate 1) | auto-passed (Gate 1 NET partly pending: Dukascopy WAF) |
| 2A | Trade time-offset detection | auto-passed (seeded NET check passed) |
| 2B | Replay payload API and notes | auto-passed |
| 2C | Prefetch hooks and time-basis writers | auto-passed |
| 2D | CandleChart wrapper | auto-passed (HUMAN pending) |
| 2E | Replay engine (TS) | auto-passed |
| 2F | Replay page shell | todo |
| 2G | Replay overlays, notes, entry points (Gate 2) | todo |
| 3A | Shared rules and scenario format (Python) | todo |
| 3B | Browser order engine (TS) | todo |
| 3C | Session backend and descriptor endpoint | todo |
| 3D | Backtesting hub and session setup | todo |
| 3E | Session simulator | todo |
| 3F | Session finish, summary, replay by reference (Gate 3) | todo |
| 4A | Strategy schema and indicators | todo |
| 4B | Strategy and run persistence | todo |
| 4C | Python engine and metrics | todo |
| 4D | Run jobs, backtest API, descriptor endpoint | todo |
| 4E | Strategy builder UI | todo |
| 4F | Results UI and runs list (Gate 4) | todo |
| 5A | Admin and operations API | todo |
| 5B | Admin data-status UI | todo |
| 5C | Scheduler lock, top-up, drills, observability | todo |
| 5D | Documentation and final report | todo |

## Current sub-phase log

Fill in during work: the files changed, the commands run with their result summary, and any deviations (with their DECISIONS ids).

- **1A:** migration 0033 (market-data tables, `jobs`, `worker_heartbeats`, `trades.is_simulated`, `trades.time_basis` with backfill). The upgrade, downgrade, upgrade round trip passes in `tests/test_bt_migrations.py`. The registry YAML is mirrored to `instruments` on startup.
- **1B:** `app/services/live_trades.py` is used by stats, advanced analytics, export, the trades router, accounts, check-ins, recaps, prop, behavior, insight rules and the progress tracker. Agents and mentor reject simulated trades explicitly. Covered by `tests/test_bt_live_trades.py`.
- **1C:**
  - AI context, AI analytics tool, insights engine and snapshot, RAG ingest and backfill (simulated trades never embedded), broker-sync upsert, broker connection delete, import duplicates and import confirm all go through the live helper.
  - No raw-SQL trade readers exist (`text(` grep: only advisory locks and `set_config`).
  - The source scan `test_every_trade_reader_uses_live_helper` passes.
  - `tests/test_bt_live_trades_ai.py` includes a golden check: full analytics, advanced analytics and the AI tools give byte-identical output before and after a simulated trade is inserted.
  - Fixed an existing bug in `rag/store.upsert_document`: it inserted the ORM attribute key `metadata`, which clashes with `Base.metadata`. It now inserts against the table.
  - Full suite: 308 passed.
- **1D:**
  - New modules: `marketdata/candles.py` (the columnar `Candles` batch), `validation.py`, `store.py`, `coverage.py` and `resolver.py`.
  - The store merges, dedups and sorts each month, writes zstd Parquet to `<root>/tmp`, then calls `atomic_replace`, which retries `PermissionError` 5 times (50 to 800 ms) and always removes the temp file.
  - Month writes are serialized by a thread lock plus an OS file lock (`msvcrt` or `fcntl`) on `<root>/locks/*.lock`, so the API's inline fill and the worker process can't interleave.
  - Every read and count opens its own DuckDB connection (D-020).
  - `coverage.record_fetch`: validate, then write, then mark covered (under a Postgres advisory transaction lock), then refresh the month stat (open-market gap minutes over the covered part, plus outliers recounted from the file). A store failure leaves coverage untouched.
  - The resolver's built-in aliases cover GOLD, SPX500, NAS100, GER40 and similar, and `BTCUSD` maps to `BTCUSDT`. Other crypto exchanges are flagged `binance_proxy` (D-011).
  - Tests: `test_bt_validation.py`, `test_bt_store.py`, `test_bt_coverage.py`, `test_bt_resolver.py`. Full suite: 371 passed.
- **1E:**
  - New modules: `providers/base.py` (`Chunk`, `ProviderError` with a code and a retryable flag, `Provider`), `providers/binance.py`, `providers/dukascopy.py`, `marketdata/verify.py`, and `app/cli/marketdata.py` with `verify-instrument`. Added `config.backend_path`, so relative data and tool paths are anchored at `backend/`.
  - Binance planning: whole past months come from monthly archives, whole past days from daily archives, and anything partial or recent from REST. A 404 or a missing checksum falls back to REST. A checksum mismatch is retried once, then raises `checksum_mismatch`.
  - Binance REST: rotates to the next host on HTTP 451 and on TLS or connection errors, and remembers the host that worked. On 429 and 418 it honours `retry-after` with jitter. It pauses when the used weight passes 80%. Only closed minutes are returned.
  - Network findings:
    - `api.binance.com` and `fapi.binance.com` fail TLS from the development network.
    - `data-api.binance.vision` and `data.binance.vision` work.
    - Futures REST is therefore unavailable here, though futures archives work.
  - `pytest.ini` registers the `live` and `seeded` markers and deselects them by default.
  - Fixtures live in `tests/fixtures/marketdata` (provenance in its README).
  - NET results:
    - `pytest -m live tests/test_providers.py`: Binance passed. Dukascopy is blocked by the WAF and stays pending.
    - `verify-instrument BTCUSDT`: OK, 1,440 of 1,440 rows for 2026-10-13, prices 81033.66 to 84168.0.
  - Tests: `tests/test_providers.py`, 25 passed.
- **1F:**
  - **Queue (`services/jobs/queue.py`):**
    - `enqueue` uses ON CONFLICT DO NOTHING on the active-dedup partial index.
    - `claim` takes a per-lane `pg_advisory_xact_lock`, checks capacity, then `FOR UPDATE SKIP LOCKED`.
    - Also: `fail` (backoff with 50% to 100% jitter, capped, honours `retry_after`), `recover_expired`, `request_cancel`, `retry_failed`, `set_progress` (extends the lock and reports cancellation), and the `register_handler` / `JobContext` registry.
  - `services/jobs/locks.AdvisoryLock` holds a session lock on a dedicated AUTOCOMMIT connection.
  - `services/jobs/provider_limiter.TokenBucket` provides one bucket per provider per process.
  - `workers/market_worker.py`:
    - Takes the advisory lock and idles if another worker holds it.
    - Each tick: heartbeat row, expired-lock recovery, extending the locks of its own running jobs, then claiming into a thread pool sized to the sum of the lane limits.
    - `MARKET_WORKER_IN_PROCESS` starts it as a thread in the API.
  - `services/backtest/errors.BacktestError` carries the stable codes, and a handler in `main.py` returns `{code, message, details?, job_id?}` plus `Retry-After`.
  - `services/backtest/entitlements` (`check_feature`, `require_feature`) allows everyone for now.
  - `api/deps.require_admin`; `services/user_roles.set_admin`; CLI `make-admin <email> [--revoke]`.
  - Tests: `tests/test_bt_jobs.py`, 17 passed. Full suite: 413 passed.
- **1G:**
  - **`marketdata/aggregation.py`:** DuckDB `arg_min(open)` / `max` / `min` / `arg_max(close)` / `sum` buckets on epoch boundaries.
  - **`cache.py`:** a bounded LRU that caches only fully covered windows (so it is safe across processes), with in-process overlap invalidation on writes.
  - **`ingest_jobs.py`:** `fill_gaps` records and commits chunk by chunk and invalidates the cache. The `candles.ingest` handler reports progress and cancels between chunks; the worker loads it.
  - **`candle_service.py`:**
    - `ensure_candles` follows D-017: inline work runs on a bounded pool behind a non-blocking semaphore and waits at most `INLINE_FETCH_TIMEOUT_S`. Everything else becomes a deduplicated job.
    - `get_candles` returns only buckets that are closed before `until`/now and fully covered. It also enforces the bar cap and returns has-more flags, `earliest_ms` and `complete_until_ms`.
  - Bug found and fixed: an empty cache is falsy, so `cache or candle_cache` silently used the global cache.
  - Spec 02 section 9.1 now carries the D-017 amendment.
  - Tests: `test_bt_aggregation.py` (independent Python reference, seeded, `BT_SEED` override) and `test_bt_candle_service.py`. Full suite: 435 passed.
- **1H:**
  - **API:** `schemas/market_data.py`, plus `api/routers/market_data.py` (a thin router) over `marketdata/read_api.py`. Endpoints:
    - `GET /api/market-data/instruments`: enabled only, with `q` and `asset_class` filters.
    - `GET /api/market-data/candles`: columnar `t/o/h/l/c/v`, start and end in epoch ms or ISO, plus `until` and `limit`. Rate limited per user (`CANDLE_REQUESTS_PER_MINUTE`, returns `rate_limited` with Retry-After). The fetch window is clipped to the last closed minute. Returns 202 `data_preparing` with `job_id` when the data isn't ready.
    - `GET /api/market-data/jobs/{id}`: backtest-lane jobs return 404 to anyone but their owner.
  - `SlidingWindowRateLimiter.allow()` is the non-raising variant; `check()` is unchanged.
  - `ensure_candles` now resolves its provider and session factories at call time.
  - **Health:** `/api/health` keeps `status` and `app` and adds `checks`: database, storage writable (probe file in `<MARKET_DATA_DIR>/tmp`), and `market_worker` (ok, stale or missing, with its age). `status` is `degraded` when any check fails, and HTTP stays 200.
  - **GZip:** global, D-018 verified.
  - **CLI:** `backfill [symbols|--all] [--from --to] [--enqueue]`, `top-up`, `seed-demo`, `coverage [--reset]`, `verify`, `add-alias`, `unresolved`. The logic lives in `marketdata/operations.py`.
  - **D-029:** the outlier baseline is floored at 1 bp of price (real BTCUSDT seed data went from 408 flags to 5).
  - **NET results:**
    - `verify-instrument BTCUSDT EURUSD XAUUSD --write`: BTCUSDT OK and written. EURUSD and XAUUSD fail with the Dukascopy WAF (202).
    - `seed-demo`: BTCUSDT 43,200 rows for 2026-09 (expected 43,200). `coverage` shows one range, no holes, 0 gap minutes, 5 outliers. `verify` OK.
    - `pytest -m seeded`: 7 BTCUSDT timeframes pass against the numpy reference; EURUSD and XAUUSD skip because they aren't seeded.
    - BTCUSDT September daily closes match Binance `/api/v3/klines?interval=1d` exactly (30 of 30 days, max relative difference 0).
  - Tests: `tests/test_candle_api.py` (17), `tests/test_seeded_candles.py` (marked seeded), and a regression test for the tick-pinned outlier case. Full suite: 453 passed.
- **2A:**
  - **Migration 0034 `account_time_offsets`:** keyed by journal account (D-023), with `broker_account_id`, `tz_kind` (iana, fixed or ny_close), `tz_value`, `confidence`, `match_rate`, `sample_size`, `runner_up` and its rate, `method`, the per-candidate `scores`, and `computed_at`. CHECK constraints guard the kind and confidence values.
  - **`marketdata/time_offsets.py`:**
    - Candidates (UTC, profile timezone, NY_CLOSE, `Etc/GMT-2`, `Etc/GMT-3`, `TIME_OFFSET_CANDIDATES`, with fixed `+HH:MM` supported) reinterpret the stored wall clock.
    - A trade is scored only if stored candles cover its entry minute under every candidate. It hits when the entry price is inside the 1m bar within the tolerance: 2 pips for forex and metals, 0.05% otherwise.
    - Confidence rules: high needs a rate of at least 0.8, a margin of at least 0.2 and at least 10 trades; medium needs at least 0.6 and a margin of at least 0.1; anything below `TIME_OFFSET_MIN_SAMPLE` or with a zero rate is unknown. Ties follow D-030.
    - `effective_utc` follows the AUDIT section 3 fallback order and returns the rule it used.
  - **Interfaces:** CLI `detect-offsets [--user email] [--account id] [--force-naive]` and `offsets-report`; `GET /api/admin/time-offsets` (admin only).
  - **D-031:** migration round trips now preserve dev data. I found this when the full suite wiped the 1H seed; I re-seeded BTCUSDT.
  - Bug found by running the CLI: `detect-offsets` printed after its session closed (DetachedInstanceError). Fixed.
  - Tests: `tests/test_time_offsets.py` (13, plus 1 seeded). Full suite: 468 passed. `pytest -m seeded`: 8 passed (the NY-close account is detected with high confidence on real September BTCUSDT data).
- **2B:**
  - **Migration 0035 `trade_replay_notes`:** user, journal trade, `replay_time_ms`, text between 1 and 2,000 characters (CHECK), an index on (user, trade), and cascade on delete.
  - **`marketdata/replay_service.py`:**
    - `ReplayTradeDescriptor` is source-neutral (journal, session or run). `build_replay_payload` resolves the instrument (unresolved gives `unresolved_symbol`; disabled gives `instrument_not_supported`), picks the default timeframe from the holding duration, and computes the suggested start (100 bars) and the replay window (200 bars before, 100 after, padded by a day, clipped to the last closed minute). It then calls `ensure_candles` (D-017), which returns ready or preparing with a job id.
    - The alignment diagnostic checks the entry and exit against their 1m bars with the tolerance; an `offset_suggestion` (price delta and points) is returned when a price is outside.
    - `journal_descriptor` converts times through `effective_utc` and reports the rule it used.
  - **Endpoints:** `GET /api/trades/{id}/replay` and `GET`/`POST /api/trades/{id}/replay-notes`, both through `get_live_trade`, so simulated and foreign trades return 404. Also `POST /api/market-data/symbol-interest` (202; increments `unresolved_symbols.interest_count`; 30 per user per hour).
  - Tests: `tests/test_replay_api.py` (22). Full suite: 489 passed.
- **2C:**
  - **`marketdata/prefetch.py`:** `prefetch_for_trades(ids)` opens its own session, loads live, non-deleted trades (at most 2,000), resolves each symbol (recording unresolved ones), skips disabled instruments, merges the replay windows per instrument, and enqueues one deduplicated `candles.ingest` job per instrument spanning the gaps. It never fetches inline and swallows every exception, logging it.
  - **Hooks (after commit):** manual create and edit (`opened_at`, `closed_at` or `symbol` changes), the legacy CSV import, file import confirm, and broker sync persist.
  - **`time_basis`:** manual and CSV use `basis_for_input` (a naive datetime gives `naive_wall_clock`, an aware one gives `utc_aware`). File confirm is `naive_wall_clock` if any execution timestamp was naive. Broker sync uses `basis_for_provider` (mt4, mt5, xm, exness and avatrade report server time; others are UTC).
  - Tests: `tests/test_prefetch.py` (12): all four paths, deduplication on repeat, an injected `plan_windows` failure still returns 201, covered windows enqueue nothing, unresolved symbols are logged, simulated trades are skipped. Full suite: 501 passed.
- **2D:**
  - `lightweight-charts@5.2.1` is pinned (D-012). Files are in `components/chart/`:
    - `chartModel.ts`: a pure `ChartModel` holding bars, markers, price lines and display settings. It survives remounts and binds to whichever backend is mounted.
    - `attachChart`: the effect body. Every resource it acquires is released by the detach function it returns.
    - `lightweightBackend.ts`: the only file that imports the library.
    - `chartTheme.ts`: reads the theme tokens and watches the root element's class, style and data attributes plus the system colour scheme.
    - `chartTime.ts`: timezone tick and crosshair formatters using `Intl`.
    - `CandleChart.tsx`: the `forwardRef` handle, an OHLC legend updated at most once per animation frame, a UTC toggle and the attribution footer.
    - `index.ts`: the `next/dynamic` export with `ssr: false`.
  - The bar cap trims in batches (10% slack), so ticks never trigger a full `setData`.
  - Gate: `npm run build` passes; `npm run typecheck` passes (it stands in for lint, D-032); `npm run test:chart-lifecycle` passes. That test checks a balanced mount, unmount, mount sequence, remount restore, ticks that only update the last bar, batch trimming, and theme and display propagation, with no theme updates after unmount.
  - The HUMAN check for 2D is in HUMAN_QA (it can be done once the 2F page exists).
- **2E:**
  - `lib/backtest/` has no React or Next imports. It holds `types.ts`, `timeframes.ts` (UTC-epoch buckets matching the server), `rng.ts` (`mulberry32`, overridable with `BT_SEED`) and `replayEngine.ts`.
  - The engine keeps a history buffer, a forward buffer of 1m candles (1,500 minutes, prefetch at 500) and one forming candle. The visible candles are built only from minutes with `time < cursor`. A starved buffer pauses playback and resumes when the chunk arrives. A throttled tab catches up in batches of at most 50 steps, with the backlog capped at 2 seconds.
  - Seek, step back and a timeframe switch all go through one rebuild: complete candles end at the bucket start, and the forming candle is rebuilt from the minutes inside the bucket up to the cursor.
  - Tests: `npm run test:replay-engine` (11 groups plus 500 seeded sequences). A planted one-minute leak fails the suite, which confirms the no-future check. `npm run typecheck` passes.

## Pending human verification

Every [NET] check that could not run and every [HUMAN] check goes here. HUMAN items also appear in `HUMAN_QA.md`. A gate is never called "passed" while its rows are open.

| Sub-phase | Label | Check | Exact command or steps | Status |
|---|---|---|---|---|
| 1E | NET | Live Dukascopy smoke | `cd backend; npm ci --prefix tools/dukascopy; .\venv\Scripts\python.exe -m pytest -m live tests/test_providers.py -k dukascopy` | pending: the development network gets an AWS WAF challenge (HTTP 202) from jetta.dukascopy.com |
| 1E | NET | Record a real Dukascopy output fixture | Run dukascopy-node for one EURUSD weekday with `-f json -v`, trim to 120 rows, and replace `tests/fixtures/marketdata/dukascopy_eurusd_m1.json` | pending (same block) |
| 1H | NET | Verify EURUSD and XAUUSD | `cd backend; .\venv\Scripts\python.exe -m app.cli.marketdata verify-instrument EURUSD XAUUSD --write` | pending: Dukascopy WAF (HTTP 202) |
| 1H | NET | Seed EURUSD and XAUUSD (expect about 28,000 to 32,000 rows each) | `.\venv\Scripts\python.exe -m app.cli.marketdata seed-demo`, then `coverage EURUSD XAUUSD` | pending (same block) |
| 1H | NET | Seeded aggregation for EURUSD and XAUUSD | `.\venv\Scripts\python.exe -m pytest -m seeded` (no skips) | pending (same block) |
| 2D | HUMAN | One chart canvas in StrictMode, no console warnings, resize and theme switching work | HUMAN_QA "2D chart lifecycle" | pending |
| 1H | NET | Cross-check EURUSD daily closes against a reference | Compare the `1d` closes from `/api/market-data/candles` with a public EURUSD daily close (for example ECB or broker statements) within 0.0005 | pending (same block) |

## Open questions (resolved by default when implementation started without answers)

1. **Uncommitted work.** `backend/` was clean, so backend files are committed normally. In `frontend/`, only files created by this feature are committed. Pre-existing dirty or untracked user files that get edited are listed under "Left uncommitted" below.
2. **D-023:** offsets are keyed per journal account (the proposed default).
3. **Test database.** Tests use the dev `DATABASE_URL` inside rolled-back transactions. Migration round trips only drop and recreate this feature's own tables and columns.
4. **Network.** Live calls are attempted for [NET] checks. Failures are recorded as pending.
5. **Frontend lint (D-032).** `next lint` no longer exists in Next 16, and there is no ESLint setup. Owner decision needed: adopt ESLint 9 flat config with `eslint-config-next`. Until then, `npm run typecheck` is the lint gate.

## Left uncommitted (pre-existing user changes in edited files)

_(none yet)_

## Commit log

| Sub-phase | Commit | Message |
|---|---|---|
| 0 | b380ab2 | backtesting(0): audit and docs |
| 1A | ac61e7a | backtesting(1a): schema, config, instrument registry |
| 1B | 754cc25 | backtesting(1b): live-trades helper and core reader exclusion |
| 1C | 206355e | backtesting(1c): AI, sync and import reader exclusion |
| 1D | df0e21b | backtesting(1d): resolver, validation, parquet store, coverage |
| 1E | 0a0179d | backtesting(1e): binance and dukascopy adapters, fixtures, verify-instrument |
| 1F | 428571b | backtesting(1f): job queue, provider limiter, market worker, errors, entitlements, make-admin |
| 1G | 382b2fd | backtesting(1g): candle service core, aggregation, cache, ingest jobs |
| 1H | 291a6ad | backtesting(1h): candle API, health, gzip, CLI, seed |
| 2A | d95633b | backtesting(2a): trade time-offset detection |
| 2B | 91ce6da | backtesting(2b): replay payload builder, replay API, notes, symbol interest |
| 2C | 7a7dbcf | backtesting(2c): prefetch hooks and time-basis writers |
| 2D | 2a5e274 | backtesting(2d): CandleChart wrapper |
