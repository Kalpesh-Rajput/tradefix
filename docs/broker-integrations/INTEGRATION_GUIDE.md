# TradeFix broker integration: done, pending, and how to finish it

Date: 2026-10-06

This is the operator guide for finishing broker and exchange sync. It matches the code in this repository. A provider is not "live" until a real account has authenticated and trades have landed in the journal.

Per-provider notes live next to this file (`binance.md`, `mt5.md`, and the rest). The audit of the old system is `AUDIT.md`. The build report is `FINAL_REPORT.md`.

## 1. Already done

### On your machine

| Step | Status |
| --- | --- |
| Database migration `0029` on local Postgres (`tradefix2`) | Done. Revision moved from `0028` to `0029`. |
| `BROKER_CREDENTIALS_KEYS` and `BROKER_CREDENTIALS_ACTIVE_KEY` in `backend/.env` | Done. Restart the API after any `.env` change or connect still returns 503. |
| `TRADEFIX_MT_BRIDGE_URL` | Not set. MetaTrader connect will fail until you set it. Port 8000 on this PC is a different app, not TradeFix-Connectors. |

### In the product

| Area | What works |
| --- | --- |
| Broker list | `GET /api/brokers` and `GET /api/brokers/{id}`. Settings → Broker and Add Trade → connect render from this list. |
| Database | Connections, encrypted credentials, broker accounts, raw provider payloads, orders, executions, positions, sync jobs, sync runs, checkpoints, import batches. Existing trades were not deleted. |
| Secrets | AES-256-GCM. The connection id is bound into the encryption. Secrets are not returned by the API. The old sessionStorage password stash no longer saves a password. |
| Sync | `POST /api/broker-connections` returns `202` and a `sync_run_id`. One sync per connection. A crashed worker is marked interrupted and can resume. Incremental sync and reconciliation are queued by the scheduler. The API process runs a worker thread when `BROKER_WORKER_IN_PROCESS` is true (the default). |
| Journal | API, file confirm, and manual trades share one path: raw row → execution → position → journal trade. The same external id does not create a second trade. |
| File API | `POST /api/imports` previews a file. `POST /api/imports/{id}/confirm` writes valid rows. Rows that need attention are kept and not imported. The old `POST /api/imports/csv` is unchanged. |
| Tests | `backend/tests/test_broker_foundation.py` — 12 passed. These do not call live brokers. |

### Providers that have an adapter

| Provider | How it connects | Live-tested here |
| --- | --- | --- |
| MetaTrader 5, MetaTrader 4, XM, Exness, AvaTrade | Existing TradeFix-Connectors bridge. No MetaApi. | No |
| cTrader | OAuth. No password form. Deals over the official JSON API (port 5036). | No |
| Binance, Bybit, Bitget, OKX, Delta Exchange | Signed REST. Read-only preferred. Binance blocks a key that can withdraw. | No |
| XTB | File import and manual only. XTB shut the public API on 14 March 2025. | No |
| Zerodha | File import and manual only. No Kite Connect adapter. | No |

Alpaca is not in the registry. Any Broker (AI) is not a model call. Unknown CSV files use header matching and a preview.

## 2. Still pending

Two kinds of work are left. Section 3 is what you do. Section 4 is code that is not finished even after you add keys.

### You still have to configure

1. Restart the API so it loads the encryption key.
2. Put the real TradeFix-Connectors URL in `TRADEFIX_MT_BRIDGE_URL`, plus a server token if that service requires one.
3. Open the TradeFix-Connectors repository and confirm it still serves `/api/broker/connect`, `/api/broker/sync`, and `/api/broker/trades`.
4. Create read-only API keys for Binance, Bybit, Bitget, OKX, and Delta (use testnet or demo first).
5. Register a cTrader Open API application and set the three `CTRADER_*` variables.
6. If Delta requires an IP allowlist, set `BROKER_EGRESS_IP` to this server's real outbound IP.
7. Collect one real export file per broker whose file import you care about, and run it through preview → confirm.
8. Connect each account once and check the journal after refresh.

### Still unfinished in code

Do not treat these as done:

| Gap | What that means |
| --- | --- |
| Standing private WebSockets | Binance, Bybit, Bitget, OKX, and Delta do not keep a live socket open. Catch-up is scheduled REST, default every 15 minutes, plus a reconciliation pass. |
| cTrader token refresh job | `refresh()` exists in `backend/app/services/brokers/providers/ctrader.py`. Nothing calls it on a schedule yet. When the access token expires, the user must connect again. |
| cTrader account picker | The callback syncs the first account returned. Choosing several accounts in the UI is not built. |
| File import screen | The API previews and confirms. The broker panel tells you to use the journal import dialog. That dialog still calls the old CSV endpoint. The new preview UI is not wired. |
| Exchange and XTB spreadsheet parsers | Only a MetaQuotes HTML "Closed Transactions" table and a Zerodha-shaped CSV header are detected. Other official exports fall through to generic CSV mapping. |
| AvaTradeGO | No parser. No sample file was verified. |
| Alpaca | Not implemented. |
| Any Broker (AI) | Not implemented. Unknown columns are left for you to map. The mapping API stores the map; it does not yet re-parse the rows with it. |
| Connectors source audit | The Connectors repo was not in this workspace. How it talks to the MT5 terminal is still unknown. |
| Local broker logos | Cards use text, not logo files. |
| Browser pass | The new settings screen was not clicked through in a browser in this build. |
| Two-user security test | Queries filter by `user_id`. That was not tested with two real users. |

## 3. Finish it: your steps

Do these in order. Stop at the first failure and read the error `code` in the API response. Do not keep retrying a bad password.

### 3.1 Restart the API

From `backend/`:

```powershell
.\venv\Scripts\python.exe -m alembic current
```

You should see `0029`. Then start the API the way you usually do (uvicorn on port 8001). Encryption keys are read only at process start.

Check:

```powershell
.\venv\Scripts\python.exe -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/api/health').read())"
```

Log in to the site, open Settings → Broker, and confirm the broker grid loads. If it 401s, you are not logged in. If it 404s, the new router is not in the process you started.

### 3.2 MetaTrader (MT5, MT4, XM, Exness, AvaTrade)

TradeFix does not log into MetaTrader by itself. It calls the existing Connectors service.

**Where the bridge is documented**

- `NGROK.md` in this repo, section "Optional: second live URL (broker / MT5)".
- That file points at `C:\test\KR\Project-TradeFix\TradeFix-Connectors` and `scripts\start-api.ps1`. That folder was not on this PC when the audit ran. Copy or clone that repo onto this machine, or tell the API the URL of a machine where it is already running.

**Start the bridge**

1. Open MetaTrader 5 (or 4) on the Windows PC that will hold the session. Stay logged into the account you want to sync, or leave the terminal ready to accept the login the bridge sends.
2. Start Connectors:

```powershell
cd C:\test\KR\Project-TradeFix\TradeFix-Connectors
.\scripts\start-api.ps1
```

3. In a browser, open `http://127.0.0.1:PORT/health` using the port the script printed. You want a JSON body that mentions brokers, not a 404 and not another product.
4. In `backend/.env` set:

```env
TRADEFIX_MT_BRIDGE_URL=http://127.0.0.1:PORT
TRADEFIX_MT_BRIDGE_TOKEN=
```

Put a token on the second line only if Connectors requires `Authorization: Bearer`. Restart the TradeFix API.

**What to type in the UI**

| Field | Where you copy it from |
| --- | --- |
| Login | MetaTrader login number, or the trading-account card in the broker cabinet (XM Members Area, Exness Personal Area, AvaTrade account details). |
| Investor password | The read-only investor password from that same cabinet. Not the website password. Not the master trading password. |
| Server | The exact server string in MetaTrader → File → Login to Trade Account. XM and Exness do not have a built-in server list. Type the name you see. |
| Date range | 7 days for the first test. |

**One terminal, one account.** A second user needs a second bridge process. This app does not run a terminal pool.

**Success looks like**

- HTTP 202, connection status `connected`.
- Sync history shows received and created counts from the bridge, not a made-up progress bar.
- Trades appear on the journal for that new account.
- Refresh the page. The trades are still there.
- Click Sync Now again. The created count stays 0 and updated/skipped covers the same deals.

**If the bridge URL is empty** the API returns `BRIDGE_NOT_CONFIGURED` and saves nothing.

### 3.3 Binance

Docs: https://developers.binance.com/docs/binance-spot-api-docs

1. Binance → profile → API Management. Create a key that can read. Leave withdrawals off. If withdrawals are on, TradeFix rejects the key and does not save it.
2. For the first test use the spot testnet: https://testnet.binance.vision/ and set Environment to `testnet`.
3. In TradeFix choose Binance, paste key and secret, choose spot or USD-M or COIN-M, choose the date range.
4. Spot history is per symbol. TradeFix looks at coins that still have a balance. If the account is flat, sync stops with `HISTORICAL_LIMIT` instead of pretending the account is empty. Put a small test balance on the testnet, or accept that limitation until symbol discovery is widened.
5. COIN-M testnet is not wired. Use COIN-M only with Environment `live`.

Live hosts:

- Spot `https://api.binance.com`
- USD-M `https://fapi.binance.com`
- COIN-M `https://dapi.binance.com`

There is no always-on user-data socket yet. New trades show up on the next incremental sync (default 15 minutes) or when you click Sync Now.

### 3.4 Bybit

Docs: https://bybit-exchange.github.io/docs/v5/intro

1. Bybit → API → create a key. System-generated key, read-only. Do not enable withdrawal.
2. Testnet first: https://testnet.bybit.com/ — set Environment to `testnet`.
3. Category: `spot`, `linear`, or `inverse`. Options are refused.
4. History requests are split into 7-day windows. A 30-day range is several calls. That is expected.

### 3.5 Bitget

Docs: https://www.bitget.com/api-doc/common/intro

1. Bitget → API Management → create a V2 key. Copy the key, the secret, and the passphrase. All three are required.
2. Product: `spot`, `usdt-futures`, `coin-futures`, or `usdc-futures`.
3. Bitget often does not tell us whether the key can withdraw. The UI says that. Prefer a read-only key anyway.
4. There is no verified Bitget demo host in this build. Use a read-only live key and a short date range for the first sync.

### 3.6 OKX

Docs: https://www.okx.com/docs-v5/en/

1. OKX → API → create a key with Read permission. Copy key, secret, and passphrase.
2. Demo: create the key inside OKX demo trading, then set Environment to `demo`. That sends the `x-simulated-trading: 1` header. A live key will fail in demo mode and the reverse.
3. Instrument: `SPOT`, `MARGIN`, `SWAP`, or `FUTURES`. `OPTIONS` is rejected.
4. Orders are stored only when we add that call. Today the journal is built from fills. A fill is not treated as a finished trade by itself. Spot round-trips are matched FIFO.

### 3.7 Delta Exchange

Docs: https://docs.delta.exchange/

This is crypto derivatives, not forex.

| Region | Environment | Base URL |
| --- | --- | --- |
| India | live | `https://api.india.delta.exchange` |
| Global | live | `https://api.delta.exchange` |
| India | testnet | `https://cdn-ind.testnet.deltaex.org` |

Global testnet is not wired. An India key will not work on the Global host.

1. Create the key in the same region you select in TradeFix.
2. If the key has an IP allowlist, the form shows `BROKER_EGRESS_IP`. Find the outbound IP of the machine that runs the API (your host, or the host dashboard). Put that exact IP in `backend/.env` as `BROKER_EGRESS_IP` and add it on Delta. Do not guess. Restart the API.
3. First call to try by hand, if sync fails, is `GET /v2/wallet/balances` with the same key. A 401 is a bad key, a bad signature, or a clock skew. It is not an empty account.

### 3.8 cTrader

Docs: https://help.ctrader.com/open-api/account-authentication/

You never type a cTrader password into TradeFix.

1. Sign in at https://id.ctrader.com/ and open Open API applications (Help Center → Open API → "Creating an application" if the menu moved).
2. Create an application. Copy the client id and client secret.
3. Redirect URI must be exactly:

```text
http://127.0.0.1:8001/api/brokers/ctrader/callback
```

Use your public API origin instead of `127.0.0.1:8001` when the API is not on this PC. The value in cTrader and in `.env` must match character for character.

4. In `backend/.env`:

```env
CTRADER_CLIENT_ID=
CTRADER_CLIENT_SECRET=
CTRADER_REDIRECT_URI=http://127.0.0.1:8001/api/brokers/ctrader/callback
```

5. Restart the API. In the broker screen choose cTrader, pick demo or live, click Continue with cTrader. You sign in on cTrader's site. The browser returns to the callback, then to Settings → Broker.
6. Demo and live are different hosts (`demo.ctraderapi.com:5036` and `live.ctraderapi.com:5036`). A demo token does not list live accounts.

Until the refresh job exists, reconnect before the access token expires (Spotware's default is on the order of weeks; the token response includes `expiresIn`).

### 3.9 XTB (file only)

XTB's own help center: https://www.xtb.com/en/help-center/our-platforms-6/does-xtb-offer-investment-automation-tools

The API ended on 14 March 2025. Do not look for an API key.

1. In xStation, export history as CSV or XLSX.
2. Save one untouched file under something like `fixtures/brokers/xtb-export.csv` in this repo (do not commit account numbers you care about; scrub them).
3. Upload through the import API (section 3.11). If columns are not recognized, the preview lists them as needing attention. Send that file to development so a parser can be locked to the real headers. Do not mark XTB import "done" from a generic CSV that happened to have `symbol` and `price`.

### 3.10 Zerodha (file only)

No Kite login is implemented.

1. Zerodha Console → Reports → Tradebook → Download CSV.
2. Help index: https://support.zerodha.com/category/console/reports/tradebook
3. A file whose header row contains `symbol`, `trade_date`, `trade_type`, `quantity`, and `price` is detected as `zerodha-tradebook-csv`. Confirm only after the preview row count matches the file.

### 3.11 File import (any broker)

The new API, while logged in:

1. `POST /api/imports` with form field `file`, optional `account_id`.
2. Read the JSON. Note `detected_format`, `valid_count`, `attention_count`.
3. `POST /api/imports/{id}/confirm`.
4. Open the journal. Refresh. Import the same file again. The second confirm should report duplicates, not a second copy of each trade.

MT4/MT5: in the terminal, Account History → right-click → Report (HTML). The parser looks for a Closed Transactions table. If your broker's HTML does not use that layout, keep the file and treat the parser as pending.

The settings screen does not upload files yet. Use the API or the existing CSV button, and know that the old CSV button skips the preview.

### 3.12 Disconnect

`POST /api/broker-connections/{id}/disconnect` stops future sync and deletes the encrypted credentials. Journal trades stay.

`DELETE /api/broker-connections/{id}/data` is the separate action that removes synced journal rows. Do not use it to test disconnect.

## 4. Code still required before you can call the integration complete

After section 3 works for the brokers you use, these are the remaining engineering tasks:

1. Open the TradeFix-Connectors repo and finish `AUDIT.md` section "TradeFix-Connectors Audit" with KEEP / REFACTOR / REPLACE from real files. Until then, MT behavior is whatever that service returns.
2. Wire `POST /api/imports` into the File Import tab: drop zone, preview table, row errors, confirm button.
3. Apply saved column mapping to rows before confirm.
4. Add parsers only after a real sample exists for XTB, Binance, Bybit, Bitget, OKX, Delta, and cTrader exports. Put samples in `fixtures/brokers/` and a test next to `test_broker_foundation.py`.
5. Schedule cTrader `refresh()` before `token_expires_at`.
6. Let the user pick which cTrader accounts to sync.
7. Run one private WebSocket per connection for Binance (`userDataStream.subscribe.signature` on `wss://ws-api.binance.com:443/ws-api/v3`), then Bybit, Bitget, and OKX. Reconnect with backoff. Keep the REST reconciliation job.
8. Add a two-user test: user A cannot read user B's connection, sync history, or import batch.
9. Click through Settings → Broker on desktop and a narrow window: search, select, error from a bad key, sync progress, Sync Now, disconnect.

## 5. Where to look things up

| You need | Look here |
| --- | --- |
| Env var names | `backend/.env.example` and `backend/.env` (the second file is secret; do not commit it) |
| Migration | `backend/alembic/versions/0029_broker_integration.py` |
| Broker metadata and UI copy | `backend/app/services/brokers/registry.py` |
| MT bridge client | `backend/app/services/brokers/providers/mt_bridge.py` |
| Exchange clients | `backend/app/services/brokers/providers/` |
| Sync queue | `backend/app/services/sync/engine.py` |
| Worker | `python -m app.workers.broker_worker` from `backend/`, or the in-process thread |
| Connect screen | `frontend/components/broker/BrokerIntegrationPanel.tsx` |
| Settings page | `frontend/components/settings/BrokerSettingsPage.tsx` |
| How MT used to be started | `NGROK.md` |
| Official provider notes and "verified on" dates | `docs/broker-integrations/*.md` |

## 6. Definition of complete

For each provider you care about, all of these are true:

- A real demo or testnet login succeeded, or a real export file was confirmed.
- Trades are in Postgres and still there after refresh.
- Running sync again does not duplicate them.
- A wrong password or a withdrawal-enabled Binance key does not get stored.
- Disconnect stops new sync and leaves old journal rows.
- The screen shows the broker's real limitation (file only, MetaTrader only, no socket yet) instead of a Connected badge you did not earn.
