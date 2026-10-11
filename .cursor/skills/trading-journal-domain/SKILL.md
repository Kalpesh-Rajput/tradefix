---
name: trading-journal-domain
description: Safely implement TradeFix trading-journal domain logic, trade lifecycle behavior, financial calculations, tagging, risk metrics, and trade record workflows.
---

# TradeFix Trading Journal Domain

## Understand the domain before changing logic
Inspect the existing trade, execution, order, account, instrument, fee, journal, tag, and strategy models. Reuse established definitions; never invent a competing schema or calculation.

## Correctness principles
- Distinguish trade, order, execution/fill, position, and closed-trade concepts wherever the product does.
- Confirm whether prices and sizes are in quote/base currency, lots, contracts, units, or another instrument-specific unit.
- Handle long and short trades consistently.
- Treat entry and exit timestamps with explicit timezone semantics; store and compare timestamps using the existing UTC/offset convention.
- Determine how partial fills, scale-ins/scale-outs, multiple executions, fees, funding, swaps, commissions, and slippage are represented before computing results.
- Don't treat unrealized P&L as realized P&L, or mix account currencies without a documented conversion method.
- Guard against divide-by-zero, missing prices, invalid quantities, precision issues, and incomplete trades.
- Preserve decimal precision appropriate to financial data; avoid unnecessary binary floating-point arithmetic for persisted money values if the codebase uses Decimal or integer minor units.

## Metrics and definitions
Before changing win rate, expectancy, profit factor, risk/reward, drawdown, or net P&L:
1. Locate the canonical implementation and existing tests.
2. Confirm the denominator, trade inclusion rules, fee treatment, date boundaries, and treatment of breakeven/partial/invalid trades.
3. Keep definitions consistent across dashboard, analytics, reports, AI tools, and exports.
4. Add tests for edge cases and a known example with an independently verified expected answer.

## Trade CRUD and workflows
- Preserve ownership checks and validation for create, edit, duplicate, delete, import, and broker-sync flows.
- Use explicit confirmation for destructive actions where expected.
- Avoid accidental duplicate records on retries or imports.
- Keep journal notes, emotions, strategies, setups, executions, and tags linked according to current relationships.

## Communication
Show the metric definition or tooltip when a metric could be interpreted multiple ways. Never imply journal insights or past performance predict future returns.
