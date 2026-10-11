---
name: api-contracts-integrations
description: Design and maintain reliable, typed API contracts between TradeFix frontend, backend services, and third-party providers without breaking existing clients.
---

# TradeFix API Contracts and Integrations

## Contract-first changes
- Locate the endpoint, request/response schemas, generated types/client, frontend caller, tests, and API documentation before editing.
- Keep naming, pagination, error format, authentication, and date conventions consistent with adjacent endpoints.
- If changing a response shape, search for all clients and internal consumers; add compatible fields or coordinate a deliberate versioned change.
- Validate untrusted input on the server, not only in the UI.
- Keep frontend types aligned with actual server responses. Do not use TypeScript types as a substitute for runtime validation at trust boundaries.

## Errors and timeouts
- Define clear errors for validation, unauthorized, forbidden, not found, conflict, rate limited, timeout, and upstream failure using existing conventions.
- Use bounded timeouts for network calls.
- Retry only transient failures and only when the operation is safe/idempotent; use backoff and jitter according to existing infrastructure.
- Avoid leaking provider internals or credentials to users.
- Make loading, retry, and failure states comprehensible in the UI.

## External services
- Wrap provider-specific response parsing and errors behind a service or adapter where the architecture supports it.
- Validate provider payloads; don't assume fields always exist or values are well-formed.
- Handle pagination, rate limits, clock skew, partial responses, and expired credentials explicitly.
- Store secrets only through the existing secret management/configuration mechanism.

## Observability
- Use request or correlation IDs where available.
- Log useful operation metadata while redacting secrets and sensitive user data.
- Track latency, result/error category, and safe identifiers—not access tokens or full private payloads.

## Verification
Test success, schema validation, empty responses, malformed upstream data, timeouts, retry behavior, authorization, and backwards compatibility as relevant.
