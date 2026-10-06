# Delta Exchange

Verified on: 2026-10-06

Docs: https://docs.delta.exchange/

Category: crypto derivatives, not forex.

Signing prehash: `METHOD + timestamp + path + ?query + body`, HMAC-SHA256 hex. Headers: `api-key`, `timestamp`, `signature`, `User-Agent`.

India live: `https://api.india.delta.exchange`. Global live: `https://api.delta.exchange`. India testnet: `https://cdn-ind.testnet.deltaex.org`. Global testnet was not verified and is rejected.

Fills: `GET /v2/fills` with `page_size=50` and the `after` cursor.

Egress IP is `BROKER_EGRESS_IP`. If unset, the form says it is not configured. It is never invented.

Not live-tested. The public docs print a signature next to a secret that does not reproduce that digest; the prehash above is what this client sends.
