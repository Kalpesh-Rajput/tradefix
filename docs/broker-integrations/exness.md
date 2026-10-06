# Exness

Verified on: 2026-10-06

Standard Exness accounts connect through MetaTrader 4 or 5. TradeFix sends the MT login, investor password, and server to the configured bridge. It does not ask for the Exness website password.

Exness also documents a Public Trader API:

- Portal: https://www.exness-api.com/
- Order history: `GET /v1/history/accounts/{account_id}/orders`
- Auth: Ed25519 `EXN-*` headers, https://www.exness-api.com/documentation/authentication
- Help Center (updated 2026-09-29): the API is only available in Vietnam and Thailand, and standard MetaTrader accounts cannot use it. https://get.exness.help/hc/en-us/articles/27866287512476-Exness-API

That API connector is not built. MetaTrader remains the path for standard accounts.
