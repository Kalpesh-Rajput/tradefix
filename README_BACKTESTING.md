# TradeFix backtesting

The full walkthrough — what you run, how replay and backtests work, and how the pieces connect — is [backtesting/E2E.md](backtesting/E2E.md).

Trade Replay, manual sessions and automated strategy runs share one candle store. Live journal trades stay separate: simulated trades are stored with `is_simulated` and are excluded from journal, analytics, export and AI readers.

## Setup

From `backend/`, with the project virtualenv:

1. Copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`.
2. Install Python dependencies and apply migrations: `alembic upgrade head` (head is `0040`: strategies, runs, candle imports, and cross-check results).
3. Install the Dukascopy tool once: `npm ci --prefix tools/dukascopy`. Dukascopy data is for personal use. Leave `DUKASCOPY_ENABLED=false` until that licence is acceptable.
4. Create an admin: `python -m app.cli.marketdata make-admin you@example.com`.
5. Start the API: `uvicorn app.main:app --reload`.
6. Start the market worker in a second terminal: `python -m app.workers.market_worker`. For local development, `MARKET_WORKER_IN_PROCESS=true` runs it inside the API instead. Only one worker holds the advisory lock.
7. From `frontend/`: `npm install` and `npm run dev`.

Or start all three with one command from the repo root: `python scripts/dev.py` (Windows: `scripts\dev.ps1`). It skips the API or the frontend when that port is already open, and it does not start a second market worker when one already holds the lock. The API also enqueues a top-up on startup when the last successful top-up is older than 26 hours, because the nightly job is at 00:35 UTC and the machine may have been off.

## Seeding candles

```text
python -m app.cli.marketdata verify-instrument BTCUSDT --write
python -m app.cli.marketdata seed-demo
python -m app.cli.marketdata coverage BTCUSDT
python -m app.cli.marketdata top-up
```

`seed-demo` loads the previous full month for BTCUSDT, EURUSD and XAUUSD. EURUSD and XAUUSD stay disabled until `verify-instrument --write` succeeds. On this development network Dukascopy returns an AWS WAF challenge, so those two symbols are still pending.

### Loading HistData folders (forex, metals, indices, oil)

Put one folder per symbol under the gitignored `downloads/` folder (`downloads/EURUSD/HISTDATA_COM_ASCII_EURUSD_M12019.zip`, monthly files such as `..._M1202609.zip` too), then from `backend/`:

```
python -m app.cli.marketdata load-histdata ../downloads --list
python -m app.cli.marketdata load-histdata ../downloads --enable --jobs 6
python -m app.cli.marketdata load-histdata ../downloads --symbols EURUSD XAUUSD --reset --enable
```

- Each folder maps to a registry instrument and is added to `instruments.yaml` if it is missing. Index folders get the usual names (`SPXUSD` is `US500`, `NSXUSD` is `US100`, `GRXEUR` is `DE40`, `UKXGBP` is `UK100`, `FRXEUR` is `FR40`, `ETXEUR` is `EU50`, `JPXJPY` is `JP225`, `HKXHKD` is `HK50`, `AUXAUD` is `AU200`, `UDXUSD` is `DXY`, `WTIUSD` is `USOIL`, `BCOUSD` is `UKOIL`).
- Bars are HistData bid candles on a fixed UTC-5 clock; they are converted to UTC once. Rerunning is safe: an unchanged zip is skipped by content hash. `--reset` drops that symbol's stored candles, coverage and import history first.
- Every zip states its whole period, so coverage runs edge to edge between zips. The first zip starts at its first bar and the last zip ends at its last bar, so nothing past the real data is claimed.
- A single corrupt print (a bar wholly far above or below both neighbours) is dropped as `spike`. Real gaps are not filled.
- `--enable` runs the stored-data checks with the gap report counted as read, prints each symbol's gap share, and enables only the ones that pass.
- The files carry no live feed. Candles after the newest HistData minute are only available if Dukascopy is reachable. Reload newer HistData zips to extend a symbol.

Other commands: `backfill`, `coverage --reset`, `verify`, `verify-instrument --stored`, `import-candles`, `add-alias`, `unresolved`. `import-candles` reads a file you already have. It does not download from Dukascopy, and it does not enable the instrument.

## Using the features

- **Trade Replay.** Open a journal trade and choose Replay, or go to `/replay/{tradeId}`.
- **Manual sessions.** Backtesting → Manual Sessions → New session. Orders fill on the next candle open. Finish writes a summary. Each trade replays at `/replay/session/{sessionId}/{tradeId}` with only those ids in the URL.
- **Strategies.** Backtesting → Strategies → New strategy. The three templates fill the form and are not saved until you save or run. Run opens `/backtest/runs/{id}`.
- **Run replay.** A finished run links each trade to `/replay/run/{runId}/{seq}`.
- **Market data admin.** After `make-admin`, open `/admin/data-status` (also linked from Backtesting for admins).

## Tests

Backend, from `backend/`:

```text
.\venv\Scripts\python.exe -m pytest tests/test_backtest_rules.py tests/test_engine.py tests/test_sessions_api.py tests/test_strategies_api.py tests/test_backtest_runs.py tests/test_admin_data.py tests/test_scheduler_lock.py tests/test_drills.py tests/test_env_example.py
```

Frontend, from `frontend/`:

```text
npm run typecheck
npm test
npm run build
```

Next.js 16 has no `next lint` here. Typecheck is the lint gate (D-032).

The 20-user load test is `python -m scripts.load_test_candles` from `backend/` against a running API. It signs in test users and mixes candle reads with session autosave for 30 seconds. Replay is included when that user already has a journal trade.

Browser tests are `npm run test:e2e` from `frontend/` after `npx playwright install chromium`. They need a separate database and data directory. Set `ENVIRONMENT=test` so the API does not call Binance or Dukascopy, run migrations, then `python -m scripts.e2e_seed`. The seed users are `e2e-trader@example.com` and `e2e-admin@example.com`. This machine’s database user cannot create that database, so the suite has not been run here.

## LICENSING_NOTES

- **TradingView Lightweight Charts** is used for candle charts. The chart footer and `/notices` attribute it. The library is TradingView Lightweight Charts™.
- **Dukascopy** historical data, via `dukascopy-node`, is documented for personal use. Do not enable it in a paid deployment unless you have a licence. Set `DUKASCOPY_ENABLED=false` to turn the adapter off. If the provider answers with a challenge or HTTP 202, the worker stops for `DUKASCOPY_BLOCK_COOLDOWN_S` (default 6 hours) and does not try to get around the block.
- **Files you import** (a Dukascopy manual export, a HistData 1-minute file, or your own csv) are your responsibility. Confirm you have the right to store and use them before running `import-candles`. Importing a file does not enable the instrument; `verify-instrument --stored` has to pass first.
- **Binance** public market data is fetched from the configured REST and archive hosts. Respect their request limits; the worker already throttles.

## Deployment readiness

- `MARKET_DATA_DIR` must sit on persistent storage. Losing it means re-running the backfill, and coverage rows no longer match the files until you reset coverage and fetch again.
- Only one market worker and one scheduler run at a time. They take Postgres advisory locks (`MARKET_WORKER_LOCK_KEY`, `SCHEDULER_LOCK_KEY`). A second process logs and waits or skips.
- Required environment: `DATABASE_URL`, `JWT_SECRET`, and a writable `MARKET_DATA_DIR`. Dukascopy also needs Node and `tools/dukascopy` installed. See `.env.example` for every setting.
- Ephemeral free-tier disks are a risk: a restart that wipes the disk drops the Parquet files while Postgres still says those minutes are covered. The next read then has holes. Use a volume that survives deploys.
- An S3-compatible store can replace `LocalParquetStore` behind the same `CandleStore` interface: write to a temp object, then commit by copy/rename so readers never see a partial file. Queries would use DuckDB `read_parquet` over `s3://` with the `httpfs` extension, one connection per query, the same way local reads open a short-lived DuckDB connection.

## Known limits

Stops and targets of type `atr` use the signal bar’s ATR. A `swing` stop uses the low or high over the lookback and then `buffer_pips`. `max_trades_per_day` counts filled entries by UTC day. The schema does not have a separate exit rule set; the engine can still close on an opposite signal, a maximum number of bars, or the stop and target. A 100,000-bar strategy run on this machine finished in 0.63 seconds. The earlier 0.48 second figure was measured before those rules were added.
