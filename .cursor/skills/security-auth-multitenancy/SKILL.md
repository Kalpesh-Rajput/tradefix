---
name: security-auth-multitenancy
description: Review and implement TradeFix authentication, authorization, user/tenant isolation, session handling, secret management, input validation, upload safety, and privacy protections.
---

# TradeFix Security, Authentication, and Privacy

## Assume all external input is untrusted
Validate request bodies, query parameters, IDs, uploaded files, imported rows, broker payloads, AI tool arguments, and client-side state on the server.

## Authentication vs authorization
- Authentication establishes identity; every resource action still requires authorization.
- Verify ownership for trades, accounts, playbooks, conversations, vectors, files, exports, API keys, billing data, and broker connections.
- Do not rely only on hidden UI controls or client-supplied user IDs.
- Test IDOR/BOLA by requesting another user's known resource identifiers.
- Keep authorization checks in a shared service/dependency where the project architecture supports it.

## Secrets and sessions
- Never hardcode or commit secrets. Use the existing environment/secret manager and validate required configuration at startup.
- Keep broker keys and provider tokens server-side; encrypt them at rest according to existing architecture.
- Redact tokens, cookies, authorization headers, passwords, and sensitive account data from logs and error messages.
- Preserve secure cookie/session settings, CSRF protections, expiration, logout, and token rotation conventions already in use.

## Input and output safety
- Use parameterized database access.
- Apply output escaping and avoid unsafe HTML rendering.
- Prevent open redirects, path traversal, unsafe deserialization, SSRF, and file parser attacks where relevant.
- Protect public endpoints with appropriate rate limits and payload limits.
- Avoid leaking internal exceptions, provider messages, prompts, system instructions, or stack traces.

## AI-specific safety
- Treat user notes and retrieved documents as untrusted content.
- Restrict tool capabilities, validate arguments, enforce authorization in the tool itself, and require confirmation for consequential actions.
- Never allow the model to bypass access controls or directly execute arbitrary SQL/code.

## Change discipline
- Don't disable security checks to make development easier.
- Avoid logging full trade/journal payloads unless a documented secure need exists.
- Add tests for unauthorized access and validation failures alongside successful behavior.
- For a suspected vulnerability, state exploit path, impact, fix, and regression tests without exposing real secrets.
