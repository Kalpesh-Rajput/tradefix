---
name: documentation-workflows
description: Create and maintain useful TradeFix technical documentation, architecture notes, API guides, setup instructions, migration notes, and operational runbooks grounded in the actual codebase.
---

# TradeFix Documentation and Runbooks

## Documentation principles
- Inspect the current implementation before describing it. Never document assumed endpoints, environment variables, workflows, schemas, or commands as facts.
- Prefer concise, actionable documentation organized around the reader's task.
- Include prerequisites, exact commands, expected outcomes, configuration, common failures, and verification steps where appropriate.
- Use sanitized examples and placeholders for secrets; never include real credentials, user data, or production identifiers.
- Keep docs synchronized with code changes, scripts, API schemas, environment examples, and migration behavior.

## Useful artifacts
- Local development setup and project structure.
- Architecture overview and data-flow diagrams.
- API request/response examples based on actual contracts.
- Import format and field mapping guidance.
- Broker connection and sync troubleshooting.
- AI tool boundaries, retrieval sources, and known limitations.
- Database migration and recovery runbooks.
- Deployment, health-check, logging, and rollback procedures.
- Test and release checklists.

## Documentation quality
- Clearly separate current behavior from planned/future behavior.
- State assumptions and limitations.
- Use relative paths that work in the repository.
- Avoid duplicating long instructions already maintained in one canonical location.
- Verify commands and links when tools are available.
