---
name: background-jobs-notifications
description: Design reliable TradeFix background jobs, scheduled tasks, queues, notifications, long-running imports, broker sync, and AI tasks using the job infrastructure already in the repository.
---

# TradeFix Background Jobs and Notifications

## Discover current infrastructure
Inspect whether the project uses Celery, Redis queues, a task scheduler, a hosted job system, or synchronous work. Apply conventions from the actual stack; don't introduce a new queue solely for familiarity.

## Job design
- Make tasks bounded, observable, retry-aware, and idempotent where possible.
- Persist enough state to distinguish queued, running, succeeded, partially succeeded, failed, canceled, and retrying where the UX needs it.
- Record safe correlation IDs, owner/account scope, start/end timestamps, counts, and structured error categories.
- Avoid storing sensitive prompt contents, trade notes, broker tokens, or private payloads in task arguments/logs unnecessarily.
- Ensure tasks re-check authorization/ownership rather than trusting user IDs from a queued message.

## Retries and concurrency
- Retry transient failures with bounded exponential backoff and jitter where appropriate.
- Don't retry permanent validation/authorization errors without a reason.
- Avoid duplicated effects across retries; use provider IDs, idempotency keys, unique constraints, or task state as appropriate.
- Bound concurrency, memory use, batch sizes, and external API calls.
- Handle worker termination, timeouts, visibility/lease expiration, and graceful shutdown according to the current queue system.

## User experience
- Provide progress only when it can be measured reliably.
- Don't claim a job is complete before its effects are committed.
- Offer actionable failure messages while keeping stack traces and secrets private.
- Prevent duplicate toasts/notifications on repeated polling or retried jobs.

## Validation
Test retries, duplicate delivery, partial failure, cancellation where supported, missing ownership, and stale job state. Document operational recovery steps for stuck jobs.
