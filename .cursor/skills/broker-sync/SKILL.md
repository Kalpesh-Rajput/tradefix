---
name: broker-sync
description: Implement and troubleshoot TradeFix broker connectors, account linking, trade synchronization, normalization, retries, and idempotent imports for providers actually supported by the repository.
---

# TradeFix Broker Connections and Sync

## Verify supported connectors
Inspect existing adapters and configuration before claiming support. The product has discussed MT4/MT5, Binance, and Bitget, but implement only connectors present in the current codebase or explicitly requested.

## Connector architecture
- Reuse the existing provider interface/adapter patterns.
- Separate authentication, account discovery, pagination, normalization, persistence, and sync status reporting.
- Normalize provider-specific symbols, side, quantity, price, timestamps, fees, order IDs, execution IDs, and currencies into canonical models without losing source identifiers.
- Preserve raw provider fields only according to existing privacy, storage, and debugging policies.

## Idempotency and consistency
- Re-syncing the same provider history must not create duplicate trades/executions.
- Use stable provider IDs and account/connector scoping when available; handle missing IDs deliberately.
- Handle late-arriving fills, updated orders, partial executions, corrections, deleted/closed positions, overlapping pagination windows, and provider clock differences.
- Make each sync's cursor/checkpoint, status, start/end times, counts, and failures observable.
- Use transactions and bounded batches to avoid partial corrupt writes.

## Reliability and security
- Use explicit connection/read timeouts and provider-aware rate limiting.
- Retry only transient failures, respecting rate-limit headers and safe operation semantics.
- Store credentials using the existing encrypted/secrets mechanism; never expose them to the browser or logs.
- Support disconnect/revocation and credential expiry safely.
- Prevent cross-user account access and validate connector ownership on every operation.

## UX
- Clearly distinguish connected, syncing, successful, partial, expired, and failed states.
- Show last sync time and actionable errors without leaking provider secrets.
- Avoid implying that synchronization is complete before writes are committed and verified.

## Tests
Test duplicate sync, pagination, rate limits, malformed data, token expiry, partial failures, timezone conversion, and tenant isolation using mocks or fixtures.
