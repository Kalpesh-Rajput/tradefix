# MetaTrader 4

Verified on: 2026-10-06

MT4 has no official Python package equivalent to MetaTrader 5. This build does not pretend otherwise.

Connect goes through `TRADEFIX_MT_BRIDGE_URL` with broker `mt4` when the platform field is mt4. If the existing bridge only accepts MT5, the bridge error is returned. Nothing is marked connected on failure.

HTML statements with a Closed Transactions table can be imported. Not live-tested.
