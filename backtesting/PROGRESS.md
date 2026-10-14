# Backtesting: Progress (resume file)

Read this first in every new context window, then `DECISIONS.md`, `AUDIT.md`, and the current sub-phase in `PLAN.md`.

## Current state

- **Plan revision:** 2 (rev 1 had 15 sub-phases; rev 2 has 32; see D-014).
- **Current sub-phase:** 2A (trade time-offset detection).
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
| 2A | Trade time-offset detection | todo |
| 2B | Replay payload API and notes | todo |
| 2C | Prefetch hooks and time-basis writers | todo |
| 2D | CandleChart wrapper | todo |
| 2E | Replay engine (TS) | todo |
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

## Pending human verification

Every [NET] check that could not run and every [HUMAN] check goes here. HUMAN items also appear in `HUMAN_QA.md`. A gate is never called "passed" while its rows are open.

| Sub-phase | Label | Check | Exact command or steps | Status |
|---|---|---|---|---|
| 1E | NET | Live Dukascopy smoke | `cd backend; npm ci --prefix tools/dukascopy; .\venv\Scripts\python.exe -m pytest -m live tests/test_providers.py -k dukascopy` | pending: the development network gets an AWS WAF challenge (HTTP 202) from jetta.dukascopy.com |
| 1E | NET | Record a real Dukascopy output fixture | Run dukascopy-node for one EURUSD weekday with `-f json -v`, trim to 120 rows, and replace `tests/fixtures/marketdata/dukascopy_eurusd_m1.json` | pending (same block) |
| 1H | NET | Verify EURUSD and XAUUSD | `cd backend; .\venv\Scripts\python.exe -m app.cli.marketdata verify-instrument EURUSD XAUUSD --write` | pending: Dukascopy WAF (HTTP 202) |
| 1H | NET | Seed EURUSD and XAUUSD (expect about 28,000 to 32,000 rows each) | `.\venv\Scripts\python.exe -m app.cli.marketdata seed-demo`, then `coverage EURUSD XAUUSD` | pending (same block) |
| 1H | NET | Seeded aggregation for EURUSD and XAUUSD | `.\venv\Scripts\python.exe -m pytest -m seeded` (no skips) | pending (same block) |
| 1H | NET | Cross-check EURUSD daily closes against a reference | Compare the `1d` closes from `/api/market-data/candles` with a public EURUSD daily close (for example ECB or broker statements) within 0.0005 | pending (same block) |

## Open questions (resolved by default when implementation started without answers)

1. **Uncommitted work.** `backend/` was clean, so backend files are committed normally. In `frontend/`, only files created by this feature are committed. Pre-existing dirty or untracked user files that get edited are listed under "Left uncommitted" below.
2. **D-023:** offsets are keyed per journal account (the proposed default).
3. **Test database.** Tests use the dev `DATABASE_URL` inside rolled-back transactions. Migration round trips only drop and recreate this feature's own tables and columns.
4. **Network.** Live calls are attempted for [NET] checks. Failures are recorded as pending.

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
