# TradeFix broker integration audit

Audit date: 2026-10-06. Checkpoint 0 only. No feature code in this pass.

This file replaces the earlier audit, which described the repo before the uncommitted broker work. Read two layers:

1. **Committed journal app** — FastAPI + Next.js trading journal. Alembic `0001`–`0028`. No broker tables on `HEAD`.
2. **Uncommitted working tree** — a broker system already added under `backend/app/services/brokers/`, `backend/app/services/sync/`, `backend/app/models/broker.py`, Alembic `0029_broker_integration.py`, and `frontend/components/broker/BrokerIntegrationPanel.tsx`. It is not committed. Later checkpoints must extend this code. Do not add a second registry, vault, or sync queue.

TradeFix-Connectors source is not in this workspace. `NGROK.md` points at `C:\test\KR\Project-TradeFix\TradeFix-Connectors`, which is not on this machine. Anything inside that process is **UNKNOWN**.

## 1. Stack

| Layer | What the repo uses |
| --- | --- |
| Frontend | Next.js 15 App Router, TypeScript, Tailwind, TanStack Query. Add Trades lives in `frontend/components/add-trades/`. |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic. Auth is email/password JWT (`app/api/deps.py`). Google OAuth exists for users, not brokers. |
| Database | PostgreSQL. No Docker. |
| Jobs | APScheduler inside the API process (`app/services/scheduler.py`). No Celery, Redis, or ARQ. |
| WebSocket | `WS /ws/account?token=` and `app/services/ws_hub.py` publish journal change notices. Not a broker stream. |
| Logging | `logging.getLogger`. No structlog, no ELK. |
| Secrets | User passwords are bcrypt. Broker secrets in the new code use AES-256-GCM (`app/services/brokers/vault.py`). |

## 2. Committed Add Trades flow (still in the tree)

`AddTradesFlow` steps: account choice → broker picker → method (auto-sync / file / manual) → connect or manual form.

- Broker list: `frontend/lib/brokers.ts` merged with `frontend/lib/brokers/unified-catalog.ts` and `frontend/lib/connectors/broker-categories.ts`.
- MT5 server names: `frontend/lib/brokers/mt5-servers.ts` (static company list, not a live server search).
- File import that is committed: `POST /api/imports/csv` → `csv_import_service.py`. Pandas, generic column aliases, `AssetType.stock`, default account, no preview.
- Manual trades: `POST /api/trades`. Journal model is `Trade` + `TradeExecution` in `app/models/trade.py`. SQL types are `Numeric`. Python annotations are still `float`.
- Old broker sync client: `frontend/lib/connectors/*` calls `NEXT_PUBLIC_CONNECTORS_URL` (`/api/broker/catalog|connect|sync|trades|account|disconnect`), then the browser inserts trades with `POST /api/trades`. Dedup is a note tag plus `localStorage` key `tradefix_broker_imported_ids`.
- `accounts.source`, `broker_id`, and `broker_name` (`0018_account_source.py`) are labels. Default source `"dummy"` means a manual portfolio, not a fake broker connection.
- `trades.is_sync` is unused on the committed path.

## 3. How MT5 is connected

**Not by the official `MetaTrader5` Python package, and not by MetaApi.** Neither import exists in this repo.

The browser contract sends `{broker, login, password, server}` to TradeFix-Connectors. `NGROK.md` describes a Windows PC with MT5 already logged in, a Connectors process, and ngrok. Whether that process uses the MetaTrader5 package, an EA, or something else is **UNKNOWN** until that repo is opened.

The uncommitted `MtBridgeConnector` (`app/services/brokers/providers/mt_bridge.py`) calls the same HTTP contract from the server when `TRADEFIX_MT_BRIDGE_URL` is set. An empty URL raises `BRIDGE_NOT_CONFIGURED`. It does not return a fake Connected state. One bridge process is one terminal session. There is no terminal pool.

## 4. Uncommitted broker system (do not rebuild)

Present on disk, untracked or modified, not proven against live accounts in this audit.

| Piece | Path | What it actually does |
| --- | --- | --- |
| Registry | `app/services/brokers/registry.py` | `GET /api/brokers` and `GET /api/brokers/{id}`. Fields, instructions, capabilities. |
| Connectors | `providers/{binance,bybit,bitget,okx,delta,ctrader,mt_bridge}.py` | Real HTTP (or cTrader WebSocket JSON). Unsupported calls are not stubbed with fake rows. |
| Vault | `vault.py` | AES-256-GCM. Associated data is the connection id. Keyring: `BROKER_CREDENTIALS_KEYS`, active id: `BROKER_CREDENTIALS_ACTIVE_KEY`. |
| Models | `app/models/broker.py` | Connections, credentials, accounts, raw records, orders, executions, positions, jobs, runs, checkpoints, events, import batches, OAuth state. |
| Migration | `0029_broker_integration.py` | Additive. Nullable columns on `trades` and `trade_executions`. Partial unique index `(broker_account_id, external_trade_id)`. Trigger blocks update/delete of `raw_provider_records` unless `tradefix.allow_raw_delete=on`. |
| Sync | `app/services/sync/engine.py` | Postgres queue. `SELECT … FOR UPDATE SKIP LOCKED` plus `pg_try_advisory_lock`. Heartbeat re-queue. APScheduler enqueues incremental (5 min tick) and reconciliation (10 min). Overlap is `sync_overlap_minutes` (default 30). |
| Worker | `app/workers/broker_worker.py` | Thread inside the API when `BROKER_WORKER_IN_PROCESS` is true (default), or `python -m app.workers.broker_worker`. |
| Ingest | `ingestion/persist.py`, `grouping.py` | Raw JSON → execution upsert → position → journal trade. Spot without a position id uses FIFO. |
| File preview | `POST /api/imports` | Detects MT HTML closed-transaction tables and a Zerodha-shaped header. Everything else is generic CSV. Confirm is separate. Legacy `POST /api/imports/csv` is unchanged. |
| UI | `BrokerIntegrationPanel.tsx` | Catalog from `/api/brokers`, schema form, 3s status poll, disconnect. Mounted at the Add Trades connect step. It does not receive the broker the picker already selected. |
| Tests | `tests/test_broker_foundation.py` | Signing prehash, symbol, fingerprint, windows, vault, redaction, XTB has no sync method, one MT HTML fixture. Not a live-provider suite. |

`docs/broker-integrations/FINAL_REPORT.md` claims checkpoints 0–9 were finished. That claim is not accepted here. The code exists. Live demo accounts were not used. Several spec items are missing (section 7).

## 5. Provider decisions checked on 2026-10-06

| Provider | Spec | What the code does | Disagreement |
| --- | --- | --- | --- |
| MT5 / MT4 | MetaApi cloud is primary. Optional Windows `MetaTrader5` package (MT5 only). MT4 EA is docs-only. | Server calls TradeFix-Connectors. MetaApi is not used. | **Yes.** This repo has a bridge client and no MetaApi client. Do not add MetaApi unless you say so. The official `MetaTrader5` package is one local terminal and one login ([MQL5 Python docs](https://www.mql5.com/en/docs/python_metatrader5)). MT4 has no equivalent package. |
| XM | MT4/MT5 with server presets. No XM web password. | MT fields. Copy says no web password. Presets are not shipped. | No API invented. Presets are missing. |
| Exness | MT route unless a public retail history API exists. | Code and `exness.md` say no retail API was verified. Bridge broker id is `exness`. | **Yes. An official API exists.** [Exness Public Trader API](https://www.exness-api.com/) documents `GET /v1/history/accounts/{account_id}/orders` (filled, cancelled, rejected; deals are separate). Auth is Ed25519 `EXN-*` headers ([authentication](https://www.exness-api.com/documentation/authentication)). Help Center, updated 2026-09-29, says the API is **only in Vietnam and Thailand**, and **standard MetaTrader accounts cannot use it** ([Exness API](https://get.exness.help/hc/en-us/articles/27866287512476-Exness-API)). Default stays MT. An Exness API connector is not built. `exness.md` is wrong until it records this. |
| AvaTrade | MT route. AvaTradeGO is file import only. | MT bridge. No AvaTradeGO parser. | No fake API. Parser is not built. A public AvaTradeGO API was not re-checked beyond the existing note. |
| cTrader | Spotware OAuth2. No password. | `GET /api/brokers/ctrader/authorize` and `/callback`. Token URL `https://openapi.ctrader.com/apps/token`. JSON on `wss://demo.ctraderapi.com:5036` and `wss://live.ctraderapi.com:5036` ([Open API help](https://help.ctrader.com/open-api/)). Needs `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI`. | Account pick-after-callback is not a separate user step. `create_connection` validates once and stores one account. Standing stream worker is not running. |
| XTB | xAPI shut down 2025-03-14. File import only. Re-check for a new API. | Registry has no `broker_sync`. | **Agree.** Help Center, updated 2026-04-17, still says API access ended on 14 March 2025 ([XTB](https://www.xtb.com/int/help-center/our-platforms/does-xtb-offer-investment-automation-tools)). No new retail API was found. X Open Hub (`xopenhub.pro`) is a different product and is not treated as XTB retail access. xStation5-specific parser and export guide are not built; uploads fall through to generic CSV. |
| Delta, Binance, Bybit, Bitget, OKX | Signed REST, permission checks, then WebSocket. | REST history connectors exist. Binance spot checks `/sapi/v1/account/apiRestrictions` and blocks `enableWithdrawals`. Futures permission check is weaker. | Private WebSocket workers are **not running**. Registry `websocket` is `not_running`. Binance `listenKey` was removed 2026-02-20 ([Binance notice](https://www.binance.com/en-BH/square/post/35363643060394)). The replacement is WebSocket API `userDataStream.subscribe.signature` (HMAC) or `session.logon` (Ed25519). The code builds that payload and does not open the socket. |
| Zerodha | Keep existing behavior. | Name in the old catalog. Header detection for a Zerodha-shaped CSV. No Kite client. | No disagreement. |
| Alpaca | Out of the new scope. | Name only. | No new adapter. |

History windows and rate limits in connector code are comments plus a few constants. They were not re-verified endpoint-by-endpoint in this audit. Do not treat `FINAL_REPORT.md` or the per-provider docs as a fresh doc review.

## 6. Security

| Issue | Where | Status |
| --- | --- | --- |
| Connectors access and refresh tokens in `localStorage` | `frontend/lib/connectors/storage.ts` | Still present. The old wizard can still use it. |
| Password bootstrap | `frontend/lib/connectors/bootstrap.ts` | `stashConnectorsBootstrap` now deletes the key. `peekConnectorsBootstrap` still reads it if another writer put `{email, password}` in `sessionStorage`. |
| Broker password through the browser to Connectors | Old client | Still possible on the old path. The new form posts once to this API. |
| Plaintext broker secrets in Postgres | New tables | Ciphertext + nonce only, if the vault is used. |
| Vault key missing | `vault.py` | Connect fails. It must not fall open. Confirm before production. |
| Connect/validate rate limit | `broker_connections.py` | **Missing.** Other routes use `app/services/rate_limit.py`. |
| `POST /{id}/validate` | Same router | Returns the stored public connection. It does not call the provider again. |
| Status `connected` | `connections.create_connection` | Set after `validate()` returns an account, before the history job finishes. |
| Egress IP | `BROKER_EGRESS_IP` | Shown only if configured. It is not detected. |
| Logged secrets | New broker loggers | Redaction helper exists (`redact.py`). A full log review of every connector error path was not done. |
| Raw payloads | `raw_provider_records.payload` | Stores provider JSON. Must not include secrets. Connectors currently store trade rows, not credentials. |
| Disconnect | `connections.disconnect` | Cancels jobs, deletes the ciphertext, keeps journal trades. Does not revoke the cTrader token or the bridge session. |
| User isolation | Queries filter `user_id` | No two-user test was run in this pass. |

Env names in this repo are `BROKER_CREDENTIALS_KEYS` and `BROKER_CREDENTIALS_ACTIVE_KEY`, not `ENCRYPTION_KEY`. Keep the repo names.

## 7. Gaps versus the spec (not done)

- MetaApi provider, XM/Exness/AvaTrade server search, and MT4 EA spec.
- Exness API connector (found, not built; region-limited).
- Standing private WebSocket workers for Binance, Bybit, Bitget, OKX, Delta, and cTrader.
- Spec status enum (`CONNECTING`, `SYNCING`, `SYNCED`, `DEGRADED`, `RECONNECTING`, `AUTH_EXPIRED`, `ERROR`). Code uses `pending`, `connected`, `needs_reauth`, `disconnected`.
- Per-connection request budgets beyond a simple min interval and backoff in `http.py`.
- Orders are a table. Connectors mostly write executions. Open orders and open positions are not a separate fetch on every provider.
- Journal money fields are still annotated `float`.
- File parsers for XTB xStation5, AvaTradeGO, cTrader, Binance, Bybit, Bitget, OKX, and Delta exports. Encoding, delimiter, and locale handling are not a real detector.
- Picker redesign (search, category tabs, popular grid, selected state) matching the existing dashboard. `BrokerIntegrationPanel` is a second UI beside `BrokerPicker` / `BrokerConnectWizard`.
- Connected-account card actions are partial (pause and disconnect exist on the API; the panel is not the full card).
- Rate limits on connect. SSE progress (the panel polls every 3s).
- Live tests. Optional testnet tests are not in the tree.
- `0029` has not been confirmed applied on a database in this pass.

## 8. What is fake

No hardcoded balances or fake Connected responses were found in the new connectors. Empty bridge URL and missing cTrader client id return errors.

These are still misleading and must be fixed before calling a provider done:

- `exness.md` says no public API was verified.
- Connection status becomes `connected` before history sync succeeds.
- `validate` does not validate.
- Registry text says deals, orders, and positions are synced for MT even though the bridge client only maps the flat `BrokerTrade` list.
- Old UI step progress is the wizard step index, not sync percent.
- Logos on the old picker are favicons.

## 9. Migration plan (when implementation resumes)

1. Apply `0029` only. Do not drop `accounts`, `trades`, or `0018` broker label columns.
2. Leave existing journal rows as `source=manual` (server default on the new column).
3. Do not import old Connectors `localStorage` connection maps. Users reconnect so secrets are encrypted here.
4. Keep `POST /api/imports/csv` until the preview path covers the same files.
5. Point MT sync at `TRADEFIX_MT_BRIDGE_URL`. If unset, MT connect stays an error.

## 10. Frontend plan (not started in this checkpoint)

- One catalog: `/api/brokers`. Retire the hardcoded merge once every current picker entry is in the registry (including file-only names).
- Add Trades connect step must open the provider the user selected, with Broker Sync / File Import / Manual as three paths.
- Remove Connectors tokens and the import-id `localStorage` list after the server dedup path is the only writer.
- Match `dash-card` spacing. Do not ship a second visual language.

## 11. Test strategy (not run in this checkpoint)

- Unit: signing vectors, window chunking, normalization, partial fills, idempotent upsert, timezone, permission block, redaction, file fixtures.
- Optional integration: skipped unless env keys exist (Binance testnet, Bybit testnet, OKX demo, Delta testnet, cTrader demo, MT demo). No real user credentials.
- This pass did not run pytest, the frontend build, or a browser session.

## 12. Stop

Checkpoint 0 ends here. Next work starts only after you say **continue**.
