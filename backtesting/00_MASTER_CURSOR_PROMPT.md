# MASTER PROMPT: Trade Replay + Backtesting for the Trading Journal Web App

Paste this whole file into Cursor as the first instruction. Place all six files of this pack in the repository under `docs/backtesting/` first, so Cursor can read them.

---

## 1. Your role

You are a senior full-stack engineer (Python/FastAPI backend, web frontend, data engineering) adding a complete, production-quality **Trade Replay and Backtesting** capability to an **existing trading journal web app**. You will plan first, then implement phase by phase, verifying each phase before starting the next. The result must be **fully functional end to end with real data**: no mock data, no placeholder screens, no dummy endpoints, no TODO stubs left behind.

## 2. Read these documents before doing anything

Read all of them completely, in this order:

1. `01_PRODUCT_AND_ARCHITECTURE.md`: what we are building, flows, architecture, scale budget, key decisions.
2. `02_DATA_PIPELINE.md`: market data (Binance for crypto, Dukascopy for forex), storage, symbol resolution, ingestion, jobs.
3. `03_BACKEND_API_AND_ENGINES.md`: database entities, API contract, manual-session logic, automated backtest engine, metrics.
4. `04_FRONTEND_SPEC.md`: pages, shared chart component, replay engine behaviour, backtest UI.
5. `05_TESTING_AND_ACCEPTANCE.md`: seed data, tests, QA checklist, acceptance criteria per phase.

If a document seems to conflict with the existing codebase's conventions, follow the codebase's conventions for style and structure, follow these documents for behaviour, and record the conflict and your resolution in `docs/backtesting/DECISIONS.md`.

## 3. Decisions already made (do not re-open them)

- **Crypto data source:** Binance public market data (bulk files plus REST candles). No user API keys are ever needed for this feature.
- **Forex, metals and indices data source:** Dukascopy historical data.
- **Chart library:** TradingView Lightweight Charts (open source). Include the required attribution notice.
- **Backtest engine:** our own small engine. The **automated backtester runs in Python on the backend**. The **interactive replay and manual simulator engine runs in the browser (TypeScript)**. Do not add third-party backtesting frameworks.
- **Storage for candles:** columnar Parquet files on local disk queried with DuckDB, behind a storage abstraction so object storage can replace local disk later. Application metadata stays in the app's existing database.
- **Job processing:** a database-backed job table plus a worker process. **No Redis or other new infrastructure** unless the app already uses it.
- **Target scale:** about 100 active users on free-tier resources, project not yet deployed. Build it cleanly and measurably within the limits in document 01, and keep every limit configurable.
- **Users do nothing:** the platform fetches all market data itself. Users never connect Binance, MT5 or anything else for this feature.

## 4. Phase 0: audit and plan (mandatory, before writing feature code)

Inspect the repository and write `docs/backtesting/AUDIT.md` covering:

- Backend: framework and version, project layout, database engine and ORM, migration tool, auth mechanism and how the current user is obtained, existing background task or scheduler mechanism, configuration and env handling, logging, test setup.
- Frontend: framework and version, routing, state management, data-fetching layer, UI component library and design tokens, how the existing analytics page is built, whether a chart library is already installed, test setup.
- Data model: how trades are stored (every field), **in which timezone trade timestamps are stored and whether they are broker-server time or UTC**, how symbols and brokers are represented, how broker sync and file import create trades, whether trades have SL, TP, size, fees.
- Existing features this work must not break.

Then write `docs/backtesting/PLAN.md`: the ordered task list per phase, files you expect to create or change, migrations needed, and risks. Record every assumption and choice in `docs/backtesting/DECISIONS.md`. **Do not stop to ask questions**; make the most reasonable decision, document it, and continue. Only stop if something makes the work impossible.

## 5. Phases and gates

Do not start a phase until the previous phase's gate passes. At each gate, run the relevant tests and actually start the app and exercise the feature.

| Phase | Scope | Gate (all must be true) |
|---|---|---|
| 1. Data foundation | Instruments registry, symbol resolver, storage, Binance and Dukascopy adapters, coverage tracking, `ensure_candles`, aggregation, job table and worker, backfill CLI, candle API | Seed command loads 1 month of BTCUSDT and EURUSD and XAUUSD; candle API returns correct aggregated candles for 1m, 5m, 15m, 1h, 4h, 1d; tests green |
| 2. Trade Replay | Replay payload endpoint, trade-to-candle resolution, prefetch on trade create/import/sync, replay page with controls and overlays | A real journal trade replays smoothly with correct entry, exit, SL, TP markers; timeframe switching works without leaking future candles |
| 3. Manual backtesting | Session model, order engine in the browser, persistence, resume, stats, journal separation | A user can create, trade, pause, resume and finish a session; stats match server recomputation |
| 4. Automated backtester | Strategy JSON validation, indicators, Python engine, job execution, results storage, strategy builder UI, results UI with replay links | A saved strategy runs as a background job, shows progress, and produces correct metrics verified by golden tests |
| 5. Hardening | Quotas and rate limits, caching, nightly top-up scheduler, data status admin view, logging, README, final QA | Every item in document 05's final checklist is satisfied |

## 6. Non-negotiable engineering rules

1. **Real data only.** Every screen reads from real endpoints backed by real stored candles. No hardcoded sample arrays in shipped code. Test fixtures live only in test folders.
2. **Follow the existing app.** Reuse its auth, design system, error handling, API client, naming and folder conventions. Match the premium look of the existing analytics page.
3. **Do not break existing features.** Backtest and replay trades must be stored and tagged so they never appear in live journal analytics.
4. **Everything is user-scoped.** Every endpoint authorizes the current user. Candle endpoints require authentication and are rate limited.
5. **No secrets in code.** Use env vars with a documented `.env.example` entry for every new setting. Every limit and threshold named in these documents must be a configuration value with the documented default.
6. **UTC everywhere internally.** Convert only at the UI edge. Normalize journal trade times to UTC in the resolver (see document 02).
7. **No look-ahead.** Indicators and signals use only closed bars. The replay UI never renders data later than the replay cursor. Golden tests must prove both.
8. **Idempotent, resumable ingestion.** Re-running any job never duplicates data. A crash mid-job never leaves corrupt files.
9. **Providers are adapters.** Binance and Dukascopy sit behind one adapter interface so another source can replace either without touching the rest of the app.
10. **Small, readable modules.** One responsibility per module, typed signatures and docstrings or JSDoc on public functions, no copy-pasted logic between the browser engine and the Python engine; instead, both implement the **same written rules** from document 03, and a shared set of scenario fixtures verifies both agree.
11. **Handle every failure visibly.** Provider down, symbol not resolvable, data not ready, job failed, quota exceeded: each has a defined API error and a clear UI state (documents 03 and 04). No silent failures and no blank charts.
12. **Write tests as you go**, per document 05, not at the end.
13. **Keep docs current.** If you change a behaviour, update the matching document in `docs/backtesting/`.

## 7. Deliverables

- All backend, frontend, migration, config and script changes, fully working.
- A backfill/seed CLI and a nightly top-up command (document 02).
- Tests per document 05, passing.
- `docs/backtesting/AUDIT.md`, `PLAN.md`, `DECISIONS.md`, and a `README_BACKTESTING.md` explaining how to set up, seed data, run the worker, run tests, and use each feature.
- `.env.example` updated.
- A final report (see document 05, section 9).

## 8. Definition of done

The feature is done only when **every acceptance criterion in document 05 passes** against real seeded data, the app starts cleanly from a fresh checkout following the README, and the final report lists what was verified, what limits apply, and any known gaps. If anything is incomplete, say so plainly in the report rather than implying completeness.

## 9. How to proceed right now

1. Read documents 01 to 05.
2. Complete Phase 0 (AUDIT.md, PLAN.md, DECISIONS.md).
3. Implement Phase 1, run its gate, then continue through the phases in order.
4. After each phase, write a short progress note appended to PLAN.md (what was done, what was verified, what changed from plan).
