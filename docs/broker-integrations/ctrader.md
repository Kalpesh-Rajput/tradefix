# cTrader

Verified on: 2026-10-06

Docs: https://help.ctrader.com/open-api/

OAuth token: `GET https://openapi.ctrader.com/apps/token` with `grant_type=authorization_code` or `refresh_token`.

Authorize page: `https://id.ctrader.com/my/settings/openapi/grantingaccess/`

JSON (not protobuf) proxies: `wss://demo.ctraderapi.com:5036` and `wss://live.ctraderapi.com:5036`.

Payload numbers are from `spotware/openapi-proto-messages` `OpenApiModelMessages.proto` (application auth 2100, account list 2149, deals 2133).

TradeFix never asks for the cTrader password. Server env: `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_REDIRECT_URI`.

The JSON session is request/response for deals. A standing execution-event stream is not running. Not live-tested.
