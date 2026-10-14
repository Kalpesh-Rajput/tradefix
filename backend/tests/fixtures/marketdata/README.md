# Market-data test fixtures

Test-only; never shipped. Provenance:

| File | Source |
|---|---|
| `BTCUSDT-1m-2024-12-30.zip` (+ `.CHECKSUM`) | First 30 rows of the real Binance spot daily archive (millisecond timestamps), re-zipped; checksum recomputed for the trimmed zip. |
| `BTCUSDT-1m-2025-03-04.zip` (+ `.CHECKSUM`) | Same, from a 2025 archive (microsecond timestamps). |
| `BTCUSDT-1m-2025-03-04.corrupt.zip` | The file above with one byte flipped (checksum mismatch case). |
| `futures-BTCUSDT-1m-2025-03-04.zip` (+ `.CHECKSUM`) | First 30 rows of the real USD-M futures archive, which has a header row. |
| `binance_rest_page.json` / `.headers` | A real `data-api.binance.vision` `/api/v3/klines` page (5 rows starting 2025-03-04 00:00 UTC). |
| `binance_429.json` | Binance's documented 429 body and headers. |
| `dukascopy_eurusd_m1.json` | 120 rows in the exact dukascopy-node 1.50.0 `-f json -v` output format (seeded synthetic prices). Live recording is pending: the Dukascopy endpoint returns an AWS WAF challenge from the development network. |
| `dukascopy_malformed_truncated.json` | The sample above cut in half. |
| `dukascopy_bad_rows.json` | 20 rows, 5 with high below low. |
