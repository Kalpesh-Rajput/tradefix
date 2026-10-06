# Binance

Verified on: 2026-10-06

Docs: https://developers.binance.com/docs/binance-spot-api-docs

Changelog: listenKey user-data endpoints were removed on 2026-02-20. This adapter subscribes with `userDataStream.subscribe.signature` on the WebSocket API. It does not call `/api/v3/userDataStream`.

Auth: HMAC SHA256 of the query string, header `X-MBX-APIKEY`.

Spot base: `https://api.binance.com`. Spot testnet: `https://testnet.binance.vision`.

USDT-M: `https://fapi.binance.com`. USDT-M testnet: `https://testnet.binancefuture.com`.

COIN-M live: `https://dapi.binance.com`. COIN-M testnet was not verified and is rejected.

History: `GET /api/v3/myTrades` and futures `userTrades` require a symbol. Symbols are taken from non-zero balances (spot) or open position risk (futures), capped at 50. If none are found the sync fails with HISTORICAL_LIMIT instead of reporting an empty account.

Permissions: `GET /sapi/v1/account/apiRestrictions` on live spot. `enableWithdrawals` blocks the connection before the key is stored.

Not live-tested against a Binance account in this environment.
