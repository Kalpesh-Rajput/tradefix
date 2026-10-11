---
name: performance-reliability
description: Diagnose and improve TradeFix frontend/backend performance, data-loading efficiency, query latency, memory use, and reliability without changing product behavior.
---

# TradeFix Performance and Reliability

## Measure first
- Reproduce the slowdown and inspect browser/network traces, React render patterns, API latency, database query plans, logs, and resource usage where available.
- Identify the bottleneck before adding caching, concurrency, memoization, or architectural complexity.
- Establish a baseline and verify improvement after the change.

## Frontend
- Avoid unnecessary client components and duplicate fetches.
- Keep state as local as practical; derive values instead of mirroring them in state.
- Memoize only when measurement or expensive computation justifies it.
- Virtualize very large tables only if the existing table pattern and scale warrant it.
- Keep chart data bounded and aggregate server-side when appropriate.
- Use responsive images, lazy loading, code splitting, and existing framework features where helpful.
- Avoid expensive layout animations, large blur/shadow regions, and layout thrashing.

## Backend and database
- Profile query latency and check for N+1, missing indexes, unbounded result sets, and repeated aggregates.
- Paginate long histories and process large files/exports in bounded batches.
- Use connection pools and timeouts consistent with current infrastructure.
- Prevent blocking I/O in async paths and avoid unbounded concurrent jobs.
- Cache only when invalidation, authorization scope, freshness, and tenant isolation are understood.

## Reliability
- Use idempotency for retryable writes and external synchronization.
- Apply bounded timeouts, appropriate retry/backoff, and concurrency limits.
- Keep failure modes explicit; don't turn errors into fake empty success responses.
- Make long-running jobs observable and safely restartable.
- Add health/readiness checks and actionable logs only when they fit existing deployment architecture.

## Success criteria
Report the measured or verified improvement and any trade-off. If no measurement tool exists, state what evidence was available rather than inventing performance numbers.
