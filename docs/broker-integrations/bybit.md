# Bybit

Verified on: 2026-10-06

Docs: https://bybit-exchange.github.io/docs/v5/intro

Auth: `X-BAPI-*` HMAC of `timestamp + api_key + recv_window + query`.

Hosts: `https://api.bybit.com`, testnet `https://api-testnet.bybit.com`.

History: `GET /v5/execution/list`, split into 7-day windows. Categories: spot, linear, inverse. Options are rejected.

Withdrawal strings in `/v5/user/query-api` permissions block the key. Account mode is read from that payload (`uta`); it is not assumed.

Private WebSocket is not running. Incremental REST plus reconciliation cover gaps.

Not live-tested.
