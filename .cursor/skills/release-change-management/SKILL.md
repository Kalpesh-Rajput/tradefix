---
name: release-change-management
description: Plan and implement safe multi-file TradeFix changes, refactors, feature delivery, and releases with impact analysis, backward compatibility, and clear completion reports.
---

# TradeFix Change Planning and Release Discipline

## Scope first
- Translate the request into observable acceptance criteria.
- Locate the real route/component/service/model and all consumers before modifying an interface.
- Identify dependencies: API contract, database migration, background task, broker adapter, AI tool, charts, export, auth, and tests as relevant.
- Prefer a small coherent patch over a broad rewrite.

## Compatibility
- Keep frontend/backend contracts compatible or update all consumers deliberately.
- For schema changes, consider old and new app versions operating during rollout.
- Keep feature flags and configuration consistent with established conventions.
- Preserve URL routes, query parameters, persisted settings, and import/export formats unless a breaking change is explicitly requested.

## Implementation
- Break multi-step work into verifiable increments.
- Use existing patterns and dependencies.
- Add regression tests and update relevant documentation.
- Do not mark tasks complete just because files have been edited.
- Keep unrelated cleanup separate where it risks obscuring functional changes.

## Before finishing
- Inspect the diff for accidental changes, secrets, debug code, generated files, and unsafe config modifications.
- Run targeted checks and broader quality checks as practical.
- Report changed areas, tests/commands, failures, assumptions, migration/backward-compatibility concerns, and anything requiring manual QA.
- Never claim a deployment, browser check, API call, or external integration test ran unless it actually did.
