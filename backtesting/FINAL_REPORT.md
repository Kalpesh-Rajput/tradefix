# Backtesting final report

Plan revision 2. Automated checks below were run in this workspace. A gate with an open NET or HUMAN row is not called passed.

## Automated results

| Id | Result |
|---|---|
| 0 | Audit and docs written |
| 1A–1D | Schema, live-trade exclusion, store and coverage tests passed |
| 1E | Adapter tests passed. Live Dukascopy calls did not |
| 1F–1G | Job queue, worker and candle service tests passed |
| 1H | Candle API, health, gzip and CLI tests passed. EURUSD and XAUUSD seed did not |
| 2A–2C | Time offsets, replay API and prefetch tests passed |
| 2D–2G | Chart lifecycle, replay engine, page and overlay script tests passed. Browser QA is still open |
| 3A–3B | Python and TypeScript scenario suites passed |
| 3C | Session API tests passed (7) |
| 3D–3F | Hub, simulator and session replay typecheck, `npm test` and build passed |
| 4A–4B | Indicator, schema and strategy API tests passed. Migration 0037 round trip passed |
| 4C | Engine, metrics and rules tests passed. A 100,000-bar run finished in 0.48s |
| 4D | Run job tests passed (cancel, time limit, bar cap, concurrency, quota reset, cache, descriptor) |
| 4E | Strategy preview script, typecheck and build passed |
| 4F | Typecheck, `npm test` and build passed |
| 5A | Admin API tests passed, including 403 for a non-admin |
| 5B | Typecheck and build passed |
| 5C | Scheduler lock and drill tests passed (11) |
| 5D | `tests/test_env_example.py` checks every Settings field is named in `.env.example` |

## Pending NET

| Check | Why it is open |
|---|---|
| Live Dukascopy smoke and a recorded EURUSD fixture | jetta.dukascopy.com returns an AWS WAF challenge (HTTP 202) |
| `verify-instrument EURUSD XAUUSD --write` | Same block. Those instruments stay disabled |
| `seed-demo` row counts for EURUSD and XAUUSD, and seeded aggregation | Same block |
| EURUSD daily close compared with a public reference within 0.0005 | No Dukascopy candles stored |
| 20-user load test `backend/scripts/load_test_candles.py` | Not run against a live API in this session |

## Pending HUMAN

These steps are also listed in `HUMAN_QA.md` and `PROGRESS.md`.

- 2D chart lifecycle in the browser
- 2F replay page states
- Phase 2 steps 1–7
- 3D hub
- Phase 3 steps 1–5
- 4E templates validate, save and run, with field errors beside the fields
- Phase 4 steps 1–5, including the spreadsheet recomputation
- 5B admin page: coverage, gaps, failures and retry
- 5D fresh checkout by following this report's README
- Final sign-off on document 05 section 8

## Measured performance

- 100,000-bar strategy run: 0.48s (cap 10s), recorded in Phase 4C.
- Repeat candle-cache reads are hits and faster than the cold load (`tests/test_drills.py`).

## Config defaults

The market-data and backtest defaults live in `backend/app/core/config.py` and are copied in `backend/.env.example`. The ones that bound a run: 500,000 bars, 30 runs per day, 1 concurrent run per user, 50 strategies, 50 sessions, 120 seconds, 24-hour result cache, 1,000 equity points. Replay alignment tolerance is 0.05 percent or 2 pips. Top-up is 00:35 UTC. Cross-check tolerance is 0.1 percent.

## Known gaps

- Stop type `atr` or `swing`, and take-profit type `atr`, fall through to a pip offset in `engine._stop` / `_target`. They are not a true ATR or swing calculation.
- `max_trades_per_day` is accepted by the schema and is not enforced while the engine is stepping.
- Frontend lint is `npm run typecheck`. Next.js 16 removed `next lint` and this repo has no ESLint config (D-032).
- Dukascopy instruments are not enabled until the NET checks above succeed.

## Deployment

See the Deployment readiness section of `README_BACKTESTING.md`. `MARKET_DATA_DIR` has to survive restarts. One worker and one scheduler hold advisory locks.
