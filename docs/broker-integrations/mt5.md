# MetaTrader 5

Verified on: 2026-10-06

Official Python package (terminal, one login): https://www.mql5.com/en/docs/python_metatrader5

This repository does not call that package. The TradeFix-Connectors source was not in the workspace, so MT5 transport stays the existing HTTP bridge (`TRADEFIX_MT_BRIDGE_URL`). If that URL is empty, connect fails with BRIDGE_NOT_CONFIGURED. No session is marked connected.

Fields: platform, timezone (display), login, investor password, server, date range.

One terminal session holds one account. A pool is not implemented.

MetaApi was not selected.

File import: MetaQuotes HTML statements that contain a Closed Transactions table. XLSX account reports were not verified and are not claimed.
