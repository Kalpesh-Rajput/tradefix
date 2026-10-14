# Backtesting: Progress (resume file)

Read this first in every new context window, then `DECISIONS.md`, `AUDIT.md`, and the current sub-phase in `PLAN.md`.

## Current state

- **Plan revision:** 2 (rev 1 had 15 sub-phases; rev 2 has 32; see D-014).
- **Current sub-phase:** Phase 0 (Audit and docs). **Not started.**
- **Blocked on:** user confirmation of plan revision 2 and the open questions below.
- **Last commit:** none for this feature.

## Sub-phase checklist

Status values: `todo`, `in-progress`, `auto-passed` (all [AUTO] checks run and passed), `done` (auto-passed and all [NET] and [HUMAN] items verified).

| Id | Scope | Status |
|---|---|---|
| 0 | Audit and docs | todo |
| 1A | Schema, config, registry | todo |
| 1B | Live-trades helper: core journal readers | todo |
| 1C | Live-trades helper: AI, sync, import, raw-SQL readers | todo |
| 1D | Resolver, validation, store, coverage | todo |
| 1E | Provider adapters, verify-instrument | todo |
| 1F | Jobs queue, worker, entitlements, errors, make-admin | todo |
| 1G | Candle service core | todo |
| 1H | Candle API, health, gzip, CLI, seed (Gate 1) | todo |
| 2A | Trade time-offset detection | todo |
| 2B | Replay payload API and notes | todo |
| 2C | Prefetch hooks and time-basis writers | todo |
| 2D | CandleChart wrapper | todo |
| 2E | Replay engine (TS) | todo |
| 2F | Replay page shell | todo |
| 2G | Replay overlays, notes, entry points (Gate 2) | todo |
| 3A | Shared rules and scenario format (Python) | todo |
| 3B | Browser order engine (TS) | todo |
| 3C | Session backend and descriptor endpoint | todo |
| 3D | Backtesting hub and session setup | todo |
| 3E | Session simulator | todo |
| 3F | Session finish, summary, replay by reference (Gate 3) | todo |
| 4A | Strategy schema and indicators | todo |
| 4B | Strategy and run persistence | todo |
| 4C | Python engine and metrics | todo |
| 4D | Run jobs, backtest API, descriptor endpoint | todo |
| 4E | Strategy builder UI | todo |
| 4F | Results UI and runs list (Gate 4) | todo |
| 5A | Admin and operations API | todo |
| 5B | Admin data-status UI | todo |
| 5C | Scheduler lock, top-up, drills, observability | todo |
| 5D | Documentation and final report | todo |

## Current sub-phase log

Fill in during work: the files changed, the commands run with their result summary, and any deviations (with their DECISIONS ids).

_(empty)_

## Pending human verification

Every [NET] check that could not run and every [HUMAN] check goes here. HUMAN items also appear in `HUMAN_QA.md`. A gate is never called "passed" while its rows are open.

| Sub-phase | Label | Check | Exact command or steps | Status |
|---|---|---|---|---|
| _(none yet)_ | | | | |

## Open questions for the user

1. **Uncommitted work in the tree.** Many unrelated files are modified or untracked: dashboard, analytics, trade components, and others. Some files these sub-phases must edit may already contain your uncommitted changes, for example `api/routers/trades.py`, `services/stats_service.py` and `imports/confirm.py`. A per-sub-phase commit (D-016) of those files would include your changes. Please choose one: commit or stash your current work before Phase 1A, or allow those files to be committed together with your changes.
2. **D-023:** store detected time offsets per journal account (proposed) or per broker account only?
3. **Local Postgres for tests:** is the `DATABASE_URL` in `backend/.env` a disposable development database that tests and migration round trips may write to (inside rolled-back transactions, and with downgrade and upgrade)? If not, provide a test database URL. Otherwise, database-dependent [AUTO] checks become pending.
4. **Network access:** may the agent make live calls to Binance and Dukascopy from this machine for [NET] checks and for seeding? Note that the full seed list backfill runs for hours.

## Commit log

| Sub-phase | Commit | Message |
|---|---|---|
| _(none yet)_ | | |
