---
name: testing-quality
description: Plan and implement tests for TradeFix UI, APIs, domain calculations, data isolation, integrations, and regressions using the repository's existing tools.
---

# TradeFix Testing and Quality Engineering

## Inspect actual test infrastructure
Read package scripts, test configs, fixtures, backend test tooling, CI workflows, and existing test conventions before selecting tools. Do not install a new testing framework for a small test without a strong reason.

## Test layers
- Unit tests for pure functions, metric calculations, parsing, validation, mapping, and formatting.
- Component tests for significant interactive states where a component test runner exists.
- API/service integration tests for persistence, permissions, transactions, and external provider adapters.
- End-to-end tests for critical user workflows when browser automation exists.
- Regression tests for any defect being fixed.

## Risk-based coverage
Prioritize:
- Authentication, ownership, cross-user isolation, and sensitive endpoints.
- Trade creation/edit/delete, executions, import/export, broker sync, and duplicate prevention.
- P&L and performance metric calculations, fees, timezone boundaries, and empty data.
- Analytics filters, date ranges, pagination, and query state.
- AI tools, retrieval isolation, prompt injection, and numeric claims.
- Subscription/billing and other irreversible workflows if present.

## Test design
- Assert outcomes, not fragile implementation details.
- Use deterministic clocks, controlled random seeds, stable fixtures, and mocked external services.
- Include boundary and failure cases, not only happy paths.
- Avoid tests that rely on live brokers, external LLMs, production data, or internet availability unless explicitly designated integration tests.
- Never use real credentials or private user trade data in fixtures.
- Ensure tests check authorization by attempting access as a different user, not just checking that a user can access their own records.

## Verification workflow
1. Run the smallest relevant test set while iterating.
2. Run lint and type checks after implementation.
3. Run the broader test suite and production build where practical.
4. Investigate failures; don't suppress, skip, or weaken tests just to get green.
5. Report the exact commands run and their outcomes, including skipped/unavailable checks.

## Browser acceptance
For UX changes, verify route entry, direct URLs, browser history, narrow layouts, keyboard focus, reduced motion, error/empty/loading states, and regression-prone modals or drawers when browser access is available.
