# Checkpoint report (0–9)

Date: 2026-10-06

This is not a claim that every provider is live-connected. No demo account was available in this environment.

## What is in the API

- Provider registry: `GET /api/brokers` and `GET /api/brokers/{id}`. The settings broker page and the Add Trade connect step render from it.
- Tables in Alembic `0029_broker_integration.py`: connections, encrypted credentials, accounts, raw records (update/delete blocked unless `tradefix.allow_raw_delete=on`), orders/executions/positions, sync jobs/runs/checkpoints/events, import batches. Existing trade rows gain nullable source and external id columns. Nothing is dropped.
- AES-256-GCM vault. Keys: `BROKER_CREDENTIALS_KEYS`, `BROKER_CREDENTIALS_ACTIVE_KEY`. Connection id is associated data.
- Sync queue: `202` plus `sync_run_id`. One active job per connection (partial unique index + advisory lock). Heartbeat and stale recovery re-queue from the checkpoint. Incremental and reconciliation are enqueued by APScheduler. A thread (`BROKER_WORKER_IN_PROCESS`, default true) or `python -m app.workers.broker_worker` runs jobs.
- Ingest: raw JSON, execution upsert, position, journal trade. Spot without a position id uses FIFO. Repeated external execution ids update the same row.
- File preview: `POST /api/imports`, confirm writes trades. Legacy `POST /api/imports/csv` is unchanged. MT HTML closed-transaction tables and Zerodha-shaped CSV headers are detected. Other CSV stays generic and rows with missing columns are marked attention, not deleted.
- XTB: file import and manual only. Official help center says the API ended on 14 March 2025.
- MT4/MT5/XM/Exness/AvaTrade: call `TRADEFIX_MT_BRIDGE_URL` (existing Connectors HTTP API) from the server. Empty URL returns `BRIDGE_NOT_CONFIGURED`. MetaApi is not used. Connectors source was not in the workspace, so its internals stay UNKNOWN. See `AUDIT.md`.
- cTrader: OAuth start and token exchange against `openapi.ctrader.com`, then JSON on port 5036 for account list and deals. Needs `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI`. No password field.
- Binance, Bybit, Bitget, OKX, Delta: signed REST history. Binance refuses withdrawal-enabled spot keys via `/sapi/v1/account/apiRestrictions` and does not use listenKey. A standing private WebSocket worker is not running. Reconciliation polling is the realtime fallback.
- Browser password bootstrap no longer writes `sessionStorage`. The new connect form posts secrets once to the API and does not keep them.

## What was not verified live

- No MT5 terminal, cTrader app, or exchange testnet keys were used. Adapters can fail against the real host for pagination or JSON framing differences. Those failures surface as error codes, not as fake trades.
- Zerodha and Alpaca remain file-or-name only. Alpaca has no new adapter.
- Any Broker AI is not a model call. Unknown files use header matching and manual preview.
- AvaTradeGO, XTB, and exchange spreadsheet layouts were not verified with a sample export beyond the MT HTML fixture and a Zerodha-shaped header check.
- User-isolation tests that need two database users were not run here. Queries filter `user_id`. Unit tests that ran: `tests/test_broker_foundation.py` (12 tests after the signature assertion fix).
- Frontend was not exercised in a browser in this pass.

## Environment

`BROKER_CREDENTIALS_KEYS`, `BROKER_CREDENTIALS_ACTIVE_KEY`, `TRADEFIX_MT_BRIDGE_URL`, `TRADEFIX_MT_BRIDGE_TOKEN`, `BROKER_EGRESS_IP`, `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI`, `BROKER_WORKER_IN_PROCESS`.

Run migration `0029` before using the new routes. Generate a 32-byte key with `python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"`.
