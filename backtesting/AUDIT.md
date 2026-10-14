# Backtesting: Codebase Audit (Phase 0)

Facts gathered from the repository on 2026-10-14. Line numbers are approximate and can drift.

## 1. Environment

| Item | Value |
|---|---|
| Development OS | Windows (win32 10.0.26300), PowerShell. Deploy target is assumed to be Linux (D-020) |
| Python | 3.12.10 (`backend/venv`) |
| Node.js | v24.21.0, which is enough for `dukascopy-node` (D-009) |
| PostgreSQL | 18.6 local, reachable through `backend/.env` `DATABASE_URL`. Alembic head was `0032` at audit time |
| numpy / pandas | 2.5.3 / 2.2.3 installed. numpy was not declared in requirements before 1A |
| duckdb / pyarrow | Not installed before 1A |

## 2. Backend

- FastAPI 0.115.6 with sync SQLAlchemy 2.0.36 (`create_engine`, `Session`), psycopg 3, Alembic 1.14 (linear numeric chain), pydantic 2.10 and pydantic-settings 2.7, httpx 0.28, APScheduler 3.10, pytest 8.3.
- `app/main.py`:
  - The lifespan hook starts APScheduler (`enable_scheduler`) and, optionally, the in-process broker worker.
  - CORS is the only middleware.
  - Routers are mounted one by one with `/api/...` prefixes.
  - The only exception handler is `BrokerError`, which returns `{code, message}`.
  - `/api/health` and the `/ws/account` WebSocket are defined here.
- `app/core/config.py`: `BaseSettings`, snake_case fields mapped to UPPERCASE env vars, cached by `get_settings()`.
- `app/api/deps.py`: `get_current_user` (Bearer JWT). `User.role` defaults to `"trader"`. There was no admin dependency.
- Errors: `HTTPException(detail=str|dict)`; some routers use `detail={"code","message"}`.
- Pagination: offset and limit.
- Rate limiting: an in-process sliding window in `services/rate_limit.py` (`SlidingWindowLimiter`).
- Job pattern: `sync_jobs` with `broker_worker` (polling every 2 s, with an in-process option).
- Storage: `services/storage.py` (local `/uploads`).
- CLI convention: argparse scripts. There is no click or typer.
- Tests: 26 files and no conftest. Integration tests use real Postgres in a rolled-back transaction with `TestClient` dependency overrides (`tests/test_advanced_analytics_api.py`).

## 3. Trade model and time basis

The `Trade` model is in `app/models/trade.py`.

- Times: `opened_at` and `closed_at` are `DateTime(timezone=True)`. Postgres `timestamptz` keeps only the instant, so whether the input was naive is lost.
- Prices and sizes: `quantity`, `entry_price`, `exit_price`, `stop_loss`, `profit_target`, `fees`, `commission`.
- Other fields: `contract_size`, `source`, `is_sync`, `provider_symbol`, `canonical_symbol`, `account_id`, `broker_account_id`, `is_deleted`.
- `User.timezone` is a `String(64)` IANA name with default `"UTC"`.

**Time basis per write path:**

| Path | Code | Input semantics | `source` value | `time_basis` assigned |
|---|---|---|---|---|
| Manual add | `api/routers/trades.py` `create_trade`; the frontend `combineDateTime` uses `new Date(local).toISOString()` | Browser-local wall time converted to a real UTC instant | `manual` | `utc_aware` |
| Legacy CSV | `services/csv_import_service.py` (`pd.to_datetime` without a timezone) | Naive wall clock of whatever the file contains | `manual` (default) | `naive_wall_clock` from 2C onward. Old rows can't be told apart from manual ones and are backfilled as `utc_aware` (see the limitation below) |
| File import confirm | `services/imports/confirm.py` `_parse_time` (naive values become UTC) | Usually a naive broker or export wall clock | `file:<format>` | `naive_wall_clock` if the value was naive, `utc_aware` if it had an offset (2C). Backfill uses `unknown` |
| Broker sync: binance, bybit, okx, bitget, ctrader, delta | `fromtimestamp(ms, tz=utc)` | Real UTC epochs | `api:<provider>` | `utc_aware` |
| Broker sync: MT bridge (mt4, mt5, xm, exness, avatrade) | `mt_bridge.py` (naive values become UTC) | Broker **server time** stored as if it were UTC | `api:<mt provider>` | `naive_wall_clock` |

Fallback rule by basis (D-013):

- `utc_aware`: the stored value is used as UTC.
- `naive_wall_clock`: use the detected offset at medium confidence or above. Otherwise use the user's profile timezone.
- `unknown`: use the detected offset at medium confidence or above. Otherwise use the stored UTC value, which preserves the status quo.

Limitation: legacy CSV rows written before 2C carry `source='manual'`, so they're backfilled as `utc_aware`. The admin can re-run detection after manually marking an account (`detect-offsets --force-naive`).

## 4. Trade readers (simulated-trade exclusion, D-005)

These are the files that query `Trade` rows. Each one is routed through `services/live_trades.py`.

**Core (1B):**
- `services/stats_service.py`, `services/dashboard_analytics.py` (works on rows loaded by stats), `services/advanced_analytics/__init__.py`
- `services/trade_export.py`
- `api/routers/trades.py`, `analytics.py`, `accounts.py`, `checkins.py`, `recaps.py`, `prop.py`
- `services/progress_tracker_service.py`, `services/behavior.py`, `services/insight_rules.py`
- `schemas/daily_recap.py` (type reference only)

**AI, sync and import (1C):**
- `services/ai/agents/context.py`, `services/ai/tools/analytics.py`
- `services/ai/insights/engine.py`, `services/ai/insights/snapshot.py`
- `services/ai/rag/ingest.py`
- `services/ingestion/persist.py`, `services/brokers/connections.py`
- `services/imports/duplicates.py`, `services/imports/confirm.py`

The full per-query list is maintained in section 4a, which is filled in during 1B and 1C.

## 5. Frontend

- Stack: Next 16.3, React 19, TanStack Query 5, zustand, framer-motion 12, react-hook-form with zod 4, Recharts 2.15, date-fns, lucide-react.
- Not installed before 2D: lightweight-charts and any virtualization library.
- `lib/api.ts`: `api.get/post/put/patch/delete`; throws `ApiError(message, status)` using `body.detail`.
- Tests: `tsx` scripts in `frontend/scripts/`, chained in `npm test`.
- `/backtest` was the "Setup Lab" expectancy table, linked from `ProductRail` (`nav.backtesting`).
- Trade detail actions are in `app/(app)/trades/[id]/page.tsx`; the preview drawer is `components/trades/preview/TradePreviewDrawer.tsx`.
- Profit and loss colours come from `lib/appearance.ts` (`PNL_PROFIT_HEX`, `PNL_LOSS_HEX`, `BAR_PROFIT_HEX`, `BAR_LOSS_HEX`).

## 6. Streaming endpoints (D-018)

- CSV `StreamingResponse`: `api/routers/analytics.py` line 174 and `api/routers/accounts.py` line 258.
- Trade export: a plain `Response` (`trades.py` line 442).
- WebSocket: `/ws/account`.
- No SSE anywhere.

## 7. Git state

- The `backend/` tree was clean at audit time.
- `frontend/` has many uncommitted and untracked user files. Frontend commits stage only files created by this feature. A pre-existing dirty file that a sub-phase edits is listed in PROGRESS as "left uncommitted (pre-existing user changes)" instead of being committed.
