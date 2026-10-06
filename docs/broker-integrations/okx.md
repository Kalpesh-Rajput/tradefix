# OKX

Verified on: 2026-10-06

Docs: https://www.okx.com/docs-v5/en/

V5. Sign: Base64 HMAC of `timestamp + METHOD + requestPath + body`. Demo sends `x-simulated-trading: 1`.

Fills: `GET /api/v5/trade/fills-history`. Orders are not imported as fills. Options are rejected.

Passphrase required. Not live-tested. Private WebSocket channels are not running; reconciliation uses REST.
