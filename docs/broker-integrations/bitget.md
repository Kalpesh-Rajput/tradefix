# Bitget

Verified on: 2026-10-06

Docs: https://www.bitget.com/api-doc/common/intro

V2 only. Headers: `ACCESS-KEY`, `ACCESS-SIGN`, `ACCESS-TIMESTAMP`, `ACCESS-PASSPHRASE`.

Sign: Base64 HMAC-SHA256 of `timestamp + METHOD + path?query + body`.

Spot fills: `GET /api/v2/spot/trade/fills`. Mix fills: `GET /api/v2/mix/order/fills`. Requests are split into 7-day windows.

Bitget does not always return a permission bitmap. The connection does not pretend it checked withdrawals.

Passphrase is required and encrypted. Not live-tested.
