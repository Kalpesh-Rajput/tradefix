---
name: backend-fastapi
description: Design, implement, and debug Python backend features and FastAPI endpoints when FastAPI is confirmed in the TradeFix repository.
---

# TradeFix Backend Engineering (FastAPI/Python where present)

## Verify the stack first
Inspect the backend's requirements/pyproject, application entry point, router layout, dependency injection, schema/model files, and tests. If the repository uses another framework, follow that framework instead of forcing FastAPI conventions.

## Layering
- Follow current project boundaries for routers/controllers, schemas, services, repositories, models, and integrations.
- Keep HTTP concerns in the route layer and reusable business logic in the appropriate service layer.
- Use Pydantic schemas for input/output validation when the project uses Pydantic.
- Use dependency injection for auth, DB sessions, and shared clients according to existing patterns.
- Avoid large route handlers that mix validation, SQL, broker calls, and response shaping.

## API correctness
- Validate all untrusted input at the boundary. Enforce length, type, range, enum, and cross-field constraints.
- Return consistent, documented status codes and error shapes matching existing clients.
- Never leak stack traces, SQL, internal paths, secrets, or provider payloads to public responses.
- Make mutation behavior explicit; use correct transaction boundaries and commit/rollback behavior.
- Handle expected domain errors separately from unexpected internal errors.
- Never make blocking network or CPU-heavy calls on an async event loop. Use the project's existing async/sync conventions and offload appropriately.

## Persistence and concurrency
- Use parameterized queries or the ORM; never concatenate untrusted input into SQL.
- Scope every query to the authenticated user's authorized resources.
- Use transactions for multi-step state changes that must remain consistent.
- Consider idempotency and race conditions for broker imports, webhooks, retryable jobs, and trade writes.
- Avoid N+1 query patterns; load only needed columns/relationships and paginate large results.

## Reliability
- Configure network timeouts and bounded retries for external services. Retry only safe/idempotent operations.
- Validate third-party responses before trusting them.
- Use structured logging with request/correlation IDs where supported, while redacting sensitive values.
- Never log credentials, authorization headers, account tokens, or full private trade payloads.

## Tests and delivery
- Add tests for success, validation failure, unauthorized access, cross-user access, not found, and upstream failure as applicable.
- Test business logic independently from HTTP where the current architecture permits it.
- Run the existing formatter/linter/type checker/test commands; report actual results.
