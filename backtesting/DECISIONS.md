# Backtesting: Decisions Log

Each entry records a decision, why it was made, and its status. Amendments keep the original text visible, marked superseded.

Status values:

- **accepted**: in force.
- **amended (rev N)**: in force, with an amendment made in that plan revision.
- **pending user**: waiting for the user's confirmation.

---

## Audit snapshot (from planning research, expanded in AUDIT.md during Phase 0)

**Backend**

- Stack: FastAPI 0.115, sync SQLAlchemy 2.0, Postgres (psycopg3), Alembic linear numeric chain (latest is `0032`).
- Settings and app: pydantic-settings, APScheduler, and no GZip middleware.
- Auth: `get_current_user`; `User.role` defaults to `"trader"`; there is no admin check.
- Existing job queue: `sync_jobs`, with `broker_worker` polling it.
- Rate limiter: in-process sliding window.
- Trade model: `Trade` has `source` and `is_sync`; there is no `is_simulated`.
- Streaming: the only `StreamingResponse`s are CSV downloads in `api/routers/analytics.py` line 174 and `api/routers/accounts.py` line 258. There are no server-sent-event endpoints. The trade export returns a plain `Response`. There is a WebSocket at `/ws/account`.
- Trade readers: about 21 backend files read `Trade` rows. They include stats, dashboard, advanced analytics, exports, trades, checkins, recaps, prop, progress, behavior, insight rules, the AI agents context and tools, AI insights, RAG ingest, broker connections, ingestion persist, and import duplicates and confirm.

**Frontend**

- Stack: Next 16, React 19, TanStack Query, Recharts. No lightweight-charts and no virtualization library.
- Tests: `tsx` scripts.
- Shared-fixture precedent: `fixtures/forex_calc.json`.

**Development OS:** Windows (win32 10.0.26300), PowerShell.

---

## D-001: Spec and plan location (accepted)
The specs and planning docs live in `backtesting/`, not the `docs/backtesting/` the master prompt names. Every spec reference to `docs/backtesting/X` means `backtesting/X`.

## D-002: Job system (accepted)
Add a new generic `jobs` table, used by ingestion and backtest jobs, and a separate `market_worker` process that mirrors `broker_worker`'s structure. The existing `sync_jobs` and broker worker are left untouched.

## D-003: Scheduler (accepted, see D-019)
The nightly top-up and the daily cross-check are registered in the existing APScheduler. A CLI `top-up` command also exists for cron.

## D-004: Admin access (accepted, see D-026)
A backend `require_admin` dependency checks `user.role == "admin"`. The frontend gates admin pages on the same role.

## D-005: Simulated-trade exclusion (amended, rev 2)
- **Original (superseded in part):** add a `Trade.is_simulated` boolean (default false, indexed), and filter it in `stats_service._closed_trades`, `advanced_analytics.load`, dashboard analytics, trade lists and exports.
- **Amendment:**
  - Every reader of `Trade` rows goes through `app/services/live_trades.py`. The readers are analytics, dashboard, trade lists, the calendar and day view, exports, tags and notes, checkins, recaps, progress, prop, behavior, insight rules, the AI assistant's SQL and tool queries, RAG ingest and retrieval, broker-sync matching and dedup, import dedup, and any raw SQL.
  - The helper always applies `is_simulated = false`.
  - The full reader list is kept in AUDIT.md. Each reader has a regression test that inserts a simulated trade and asserts it is absent.
  - A golden test asserts that results for non-simulated data are byte-identical before and after.
  - New code must not query `Trade` directly. This is enforced by the reader tests and code review.
  - Work happens in sub-phases 1B (core readers) and 1C (AI, sync and import readers).

## D-006: Response compression (accepted, conditional, see D-018)
Add `GZipMiddleware(minimum_size=1024)` globally, subject to the streaming verification in D-018.

## D-007: Frontend tests (accepted)
Follow the existing `tsx` script convention (`frontend/scripts/test-*.ts` with `node:assert`), chained in `npm test`. No new test runner.

## D-008: Shared golden scenarios (accepted, see D-025)
They live in `fixtures/backtesting/scenarios/*.json` and are read by both pytest and tsx, following the `fixtures/forex_calc.json` precedent.

## D-009: Dukascopy downloader (accepted)
`dukascopy-node` is pinned in `backend/tools/dukascopy/package.json` plus its lockfile and invoked as a subprocess. Node is already a project requirement for the frontend. The adapter sits behind `DUKASCOPY_ENABLED`, because of the personal-use licensing.

- **1E note:** the pinned version is 1.50.0; install it with `npm ci` in `backend/tools/dukascopy`.
- **Arguments:** `-t m1 -p <side> -utc 0 -v -f json -r 3`. Flats are excluded by omitting `-fl`.
- **Empty output:** on a chunk that has open-market minutes, empty output raises the retryable `provider_empty` error, so a blocked or empty download is never marked covered.
- **Network:** from the development network, `jetta.dukascopy.com` answers with an AWS WAF challenge (HTTP 202, empty body) and `datafeed.dukascopy.com` answers 429. We do not try to bypass the WAF.
- **Pending checks:** live Dukascopy verification (EURUSD, XAUUSD) is a pending [NET] item, to be run from a network the provider serves.

## D-010: Existing `/backtest` page (accepted)
It becomes the Backtesting hub, with the tabs Manual Sessions, Strategies, Runs, and Setup Lab. The current expectancy table moves unchanged into the Setup Lab tab.

## D-011: Crypto trades from other exchanges (accepted)
Bybit, OKX and Bitget trades replay with Binance data for the same pair. The UI shows a "prices from Binance, may differ slightly" note.

## D-012: Chart library (accepted)
`lightweight-charts` v5 is pinned to an exact version. The installed major version and its API are recorded here once installed (in 2D).

## D-013: Trade time normalization (amended, rev 2)
- **Original (superseded):** normalize to UTC in the resolver; treat naive datetimes as UTC unless a broker server-offset setting exists.
- **Amendment:** no blanket "naive means UTC" rule. Instead:
  1. Each trade carries a `time_basis` (D-022). A value is treated as UTC directly **only** when its basis is `utc_aware`.
  2. For `naive_wall_clock` or `unknown` trades, `time_offsets.py` tests candidate offsets over an account's trades. It picks the one under which entry prices most often fall inside the entry-minute 1m candle's range, within the alignment tolerance. The candidates are:
     - UTC
     - The user's profile timezone
     - Common broker server offsets: `Etc/GMT-2`, `Etc/GMT-3`, and New York close with DST (America/New_York plus 7 hours, which equals EET/EEST)
     - Any extra entries in `TIME_OFFSET_CANDIDATES`
  3. The result is stored per account (D-023): the chosen timezone, `confidence` (high, medium, low or unknown), the match rate, the sample size, the runner-up, and `computed_at`. It is used for that account's replays when confidence is medium or above.
  4. Detection **runs only when stored candle data covers those trades' entry minutes**. It never triggers a fetch. With no data, or with a sample below `TIME_OFFSET_MIN_SAMPLE` (default 5), confidence is `unknown`.
  5. The fallback order is:
     - Detected offset (medium or higher confidence)
     - Then the user's profile timezone, for naive values such as CSV imports with no candle data to test against
     - UTC only for `utc_aware` values
  6. Every replay payload states which rule produced its UTC times.
  7. Tests cover at least three situations: true UTC, naive New York close across a DST boundary, and naive user-local time. An admin-visible report is available through the CLI `offsets-report` (2A), the endpoint `GET /api/admin/time-offsets` (2A), and the admin UI (5B).

## D-014: Sub-phase sizing and renumbering (accepted, rev 2)
A sub-phase touches at most about 8 files and never mixes backend and UI work. Revision 1's 15 sub-phases become 32:

- 1A becomes **1A, 1B, 1C, 1D**: schema and config; the core readers' simulated-trade exclusion; the AI, sync and import readers; then resolver, validation, store and coverage.
- 1B becomes **1E**.
- 1C becomes **1F, 1G, 1H**: jobs and worker; the candle service core; then the API, CLI, seed and Gate 1.
- The new **2A** is time-offset detection.
- 2A becomes **2B, 2C**.
- 2B becomes **2D, 2E**.
- 2C becomes **2F, 2G**.
- 3A becomes **3A, 3B**: Python rules; then TypeScript rules.
- 3B becomes **3C**.
- 3C becomes **3D, 3E, 3F**.
- 4A becomes **4A, 4B**.
- 4B becomes **4C, 4D**.
- 4C becomes **4E**.
- 4D becomes **4F**.
- Phase 5 becomes **5A, 5B, 5C, 5D**.

The user's requested "1C jobs" and "1D candle service" are 1F and 1G+1H. They shifted because simulated-trade exclusion and storage must land first.

## D-015: Gate honesty (accepted, rev 2)
Every gate check is labelled [AUTO], [NET] or [HUMAN].

- Only [AUTO] checks the agent actually ran and saw pass may be ticked.
- [NET] checks that could not run, and all [HUMAN] checks, are recorded in PROGRESS.md under "Pending human verification" with exact commands or steps. HUMAN checks are also in HUMAN_QA.md.
- A phase gate is reported as "automated checks passed, N items pending", never as "passed", while items remain.
- The next sub-phase may start after the previous one's [AUTO] checks pass.
- FINAL_REPORT lists every pending item.

## D-016: Commits and migrations (accepted, rev 2)
- One commit per sub-phase, as `backtesting(<id>): <scope>`.
- Stage only the paths the sub-phase touched (`git add <paths>`); never `git add -A`.
- Every migration has an automated upgrade, downgrade and re-upgrade round trip, plus a schema-assertion test.

## D-017: Inline fetch limits (accepted, rev 2; amends the 02 section 9.1 design)
- Dukascopy ranges **always** go through a job, never inline.
- An inline fill is allowed only for Binance REST, only for gaps up to `INLINE_FETCH_MAX_GAP_MINUTES` (default 4,320, which is 3 days), and only within `INLINE_FETCH_TIMEOUT_S` (default **8**, configurable).
- A global semaphore `INLINE_FETCH_MAX_CONCURRENT` (default 4) caps concurrent inline fetches across the process. Requests over the cap, or that time out, get the `data_preparing` (202) response with a deduplicated job.
- Rationale: FastAPI runs sync handlers in a bounded threadpool (about 40 threads by default), and long provider calls there starve every endpoint. **Rule: sync request handlers must never block the threadpool for long.** Anything that can't finish within the inline limit becomes a job.
- This rule goes into README_BACKTESTING and 02 section 9.1 when 1G is implemented.

## D-018: GZip and streaming endpoints (accepted, rev 2, verification pending in 1H)
- Planning audit result: there are no SSE or event-stream endpoints in backend or frontend. Grep for `StreamingResponse`, `EventSource`, `text/event-stream` and `getReader()` found only:
  - The CSV `StreamingResponse`s in `analytics.py` line 174 and `accounts.py` line 258.
  - A plain-`Response` trade export in `trades.py` line 442.
  - The WebSocket `/ws/account`, which GZip middleware does not affect.
- Plan: add global GZip in 1H with automated tests proving the CSV streams return complete bodies and the WebSocket still connects.
- If any check fails, restrict gzip to `/api/market-data/*` with a path-scoped wrapper and record the result here.
- Any future streaming endpoint (for example AI streaming) must be added to the exclusion test.

## D-019: Singleton worker and scheduler (accepted, rev 2)
- `market_worker` holds `pg_try_advisory_lock(MARKET_WORKER_LOCK_KEY)` on a dedicated connection for its lifetime. A second instance logs and idles. This also covers the in-process option under multiple uvicorn workers.
- `start_scheduler` takes `pg_try_advisory_lock(SCHEDULER_LOCK_KEY)`. Only the lock holder runs APScheduler. This also stops existing broker-sync scheduling from duplicating under multiple uvicorn workers, which is a behaviour improvement to note in the 5C commit.
- Every scheduler-enqueued job has a dedup key (`topup:<YYYY-MM-DD>`, `crosscheck:<YYYY-MM-DD>`), so a duplicate run cannot create duplicate jobs.

## D-020: Windows-tolerant storage and DuckDB per query (accepted, rev 2)
- The development OS is Windows; deployment is likely Linux.
- Atomic replace uses `os.replace` and retries on `PermissionError` with short backoff (5 attempts: 50, 100, 200, 400 and 800 ms) before failing the write and cleaning up the temp file.
- DuckDB opens a fresh in-memory connection per query, passes an explicit Parquet file list, and closes the connection in `finally`. No long-lived connections or handles hold Parquet files open, because Windows blocks a rename over an open file.

## D-021: Replay of simulated trades by reference (accepted, rev 2; supersedes the revision 1 `replay/sim` query-param design)
- Routes:
  - `/replay/session/[sessionId]/[tradeId]` for manual session trades
  - `/replay/run/[runId]/[seq]` for backtest run trades
- Each page loads its descriptor from a user-scoped endpoint:
  - `GET /api/backtest/sessions/{session_id}/trades/{trade_id}/replay` (added in 3C)
  - `GET /api/backtests/{run_id}/trades/{seq}/replay` (added in 4D)
- No trade data appears in URLs.
- Both endpoints call the shared `build_replay_payload(descriptor)` from 2B. A non-owner gets 404.

## D-022: `trades.time_basis` column (accepted, rev 2)
- A new column `time_basis` takes the values `utc_aware`, `naive_wall_clock` or `unknown`, and is added in migration `0033`.
- The migration backfills it from `source`, using the AUDIT "time basis" table: for example API providers that return true UTC epochs are `utc_aware`; MT-style server-time providers and CSV and file imports are `naive_wall_clock`; anything unclear is `unknown`.
- Write paths set it from 2C onward.
- Reason: `timestamptz` loses whether the original input was naive, so provenance must be stored explicitly.

## D-023: Time-offset scope key (accepted by default; implementation started without objection)
Proposed: detected offsets are stored per **journal account** (`trades.account_id`), with `broker_account_id` recorded when present. This covers manual entries, CSV and file imports, and broker sync. The alternative, keying only by broker account, would leave CSV-imported accounts without detection. Please confirm.

## D-024: CandleChart is client-only and StrictMode-safe (accepted, rev 2)
- `CandleChart` is a client component, loaded with `next/dynamic` and `ssr: false`.
- The chart is created inside an effect and destroyed with `chart.remove()` in cleanup. Chart and series refs are nulled on cleanup, so React 19 StrictMode's double mount produces exactly one chart and one set of series.
- The `ResizeObserver` and theme subscriptions are disconnected on unmount.
- The lifecycle logic is extracted into pure functions with an automated balance test.
- Checking for a single canvas and no console warnings in dev StrictMode is a [HUMAN] check (HUMAN_QA 2D).

## D-025: Scenario format, schema validation, seeded randomness (accepted, rev 2)
- `fixtures/backtesting/scenario-format.md` defines the fields and a `tolerance` block. Defaults: price 1e-8 (absolute), pips 1e-6, R 1e-6, money 0.005 (absolute, in account currency), ratios 1e-6. Each scenario may override these.
- Python validates scenario files with a pydantic model; TypeScript validates them with a zod schema (zod is already a dependency). Both reject unknown fields.
- Property tests use seeded generators: `random.Random(seed)` or numpy `default_rng(seed)` in Python, and `mulberry32` in `lib/backtest/rng.ts`. The seed is printed on failure and can be overridden with `BT_SEED`, so failures are reproducible.

## D-026: `make-admin` CLI (accepted, rev 2)
- `python -m app.cli.marketdata make-admin <email>` sets `role = "admin"`. `--revoke` sets it back to `trader`. The command is idempotent and logs the change. It is added in 1F and documented in README_BACKTESTING.
- Reason: no admin user exists yet, and the admin endpoints need one.

## D-027: Instrument verification (accepted, rev 2)
- Every `instruments.yaml` entry starts with `enabled: false` and `verified_on: null`.
- `verify-instrument <symbols...> [--write]` (1E) fetches one real recent day and checks the row count, sanity price ranges and validation. With `--write`, it sets `verified_on: <YYYY-MM-DD>` and `enabled: true`.
- Before Gate 1, BTCUSDT, EURUSD and XAUUSD must be verified. Unverified instruments stay disabled.
- If there's no network, this is recorded as pending [NET].

## D-028: Deployment readiness documentation (accepted, rev 2)
README_BACKTESTING (5D) includes a Deployment readiness section covering:

- `MARKET_DATA_DIR` must be on persistent storage. Losing it means re-running the backfill, and coverage rows must be reset with the `coverage --reset` CLI.
- Exactly one market worker and one scheduler run, enforced by D-019.
- The list of required environment variables.
- Ephemeral free-tier disks are a risk.
- How an S3-compatible `CandleStore` plugs in: the interface methods, the temp-object-then-commit semantics, and DuckDB httpfs `read_parquet('s3://...')` per query.
