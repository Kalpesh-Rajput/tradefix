# Scenario fixture format

Shared by the Python rules (`app.services.backtest.rules`) and the TypeScript order engine. One JSON file per scenario. Unknown fields are rejected.

## Top level

| Field | Meaning |
|---|---|
| `id` | Stable scenario id, for example `01`. |
| `description` | What the scenario proves. |
| `tolerance` | Optional overrides. Defaults: price `1e-8`, pips `1e-6`, R `1e-6`, money `0.005`, ratio `1e-6`. |
| `seed` | Optional integer. Property tests print it on failure. Override a run with the `BT_SEED` environment variable. |
| `cases` | Optional list of independent cases. When omitted, the top-level instrument, candles, actions and expected form one case. |

## A case

| Field | Meaning |
|---|---|
| `instrument` | `symbol`, `asset_class` (`forex`, `metal`, `index`, `crypto`), `pip_size`, `contract_size`, `quote_currency`, `price_decimals`. |
| `costs` | `spread_pips`, `commission_per_lot` (per side), `slippage_pips`. Candle prices are bid. Half the spread is charged on entry and half on exit. Slippage applies to market and stop fills, against the trader. |
| `account_currency` | Defaults to `USD`. `USDT` is treated as USD. |
| `conversion_rate` | Quote-to-account rate at the exit. When the quote is not the account currency and this is missing, profit stays in the quote currency and the result is warned `conversion_unavailable`. |
| `close_at_end` | `end of data` or `session end`. An open position is closed at the last bar's close. |
| `candles` | `time` (epoch ms), `open`, `high`, `low`, `close`. |
| `actions` | Applied on bar `at` (0-based). `place` carries an `order`. `cancel` carries `order_id`. `close` closes the open position at that bar's close. |
| `expected` | `fills`, `trades`, `warnings`, and optional `stats` (`net_profit`, `trade_count`, `wins`). |
| `seed` | Optional per-case seed. |

## Orders

`id`, `side` (`buy` or `sell`), `kind` (`market`, `limit`, `stop`), `size` (lots, or base units for crypto), optional `price`, `sl`, `tp`.

A market order placed on bar `i` fills at the open of bar `i + 1`. Within a bar the engine fills queued markets, triggers pending orders, checks the stop before the target, then applies closes, then accepts new actions.

## Property tests

`seed` (or `BT_SEED`) drives `random.Random` in Python and `mulberry32` in TypeScript. A failing property test prints the seed it used.
