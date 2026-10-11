---
name: tradefix-project-context
description: Project-wide guidance for planning, changing, reviewing, and validating the TradeFix trading journal SaaS. Use for cross-cutting tasks or when the correct subsystem is not yet clear.
---

# TradeFix Project Context

## Mission
Build and maintain TradeFix, a reliable, premium trading-journal product. Help traders record and review trades, understand performance, connect broker accounts, explore analytics, and use AI assistance without compromising correctness, privacy, speed, or trust.

## First step: inspect the real repository
- Read the relevant page/component, its parent layout, related services, types, tests, and package scripts before editing.
- Identify the actual frontend and backend roots. The known web frontend uses Next.js App Router, React, and TypeScript; Framer Motion is already used in parts of the frontend. Treat these as starting context and verify current files and versions.
- The backend has previously used Python/FastAPI and PostgreSQL. Confirm this from the current repository before applying backend-specific assumptions.
- Follow established patterns rather than creating parallel abstractions or replacing working libraries.
- Search for an existing component, helper, endpoint, schema, or service before adding another one.

## Product invariants
- Preserve existing behavior unless the task explicitly changes it.
- Do not alter financial calculations, API contracts, authentication, authorization, database schemas, broker behavior, or billing rules as incidental UI work.
- Treat trade data and account information as user-owned and private. Every read and write must respect the existing tenancy and authorization model.
- Do not fabricate trades, metrics, chart values, broker status, backtest results, AI findings, or successful operations.
- Keep financial information understandable: define units, time ranges, currency, timezone, fees, and calculation assumptions wherever relevant.
- Prefer reusable components, semantic design tokens, and small, cohesive changes.
- Preserve URL behavior, browser history, deep links, search/filter state, and responsive layout.

## Execution workflow
1. Translate the request into acceptance criteria and identify likely affected areas.
2. Inspect current implementation and determine the smallest safe solution.
3. If a requested implementation is ambiguous in a material way, state the assumption and choose the least destructive path; do not repeatedly ask for details that code inspection can answer.
4. Implement the change, including required loading, empty, error, disabled, success, and accessibility states.
5. Add/update tests appropriate to the risk and the project's actual testing stack.
6. Run available targeted checks, then broader lint/type/test/build checks when practical.
7. Report changed files, decisions, checks actually run, outcomes, and unresolved risks. Never claim a check passed unless it ran successfully.

## Safe editing
- Avoid unrelated refactors and formatting churn.
- Do not delete existing tests or weaken validation merely to make a build pass.
- Do not introduce a new dependency without a concrete need; check whether an installed package already solves the problem.
- Do not expose secrets, environment values, private user data, credentials, or full tokens in logs or documentation.
- Before destructive data migrations, data backfills, or changes to production configuration, explain the impact and include a rollback/backup strategy.

## Definition of done
The requested behavior works in the real code path, existing functionality remains intact, errors are handled, relevant checks have been run, and the final report is factual.
