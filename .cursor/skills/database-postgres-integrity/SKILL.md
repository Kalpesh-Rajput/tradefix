---
name: database-postgres-integrity
description: Safely evolve TradeFix relational data models, PostgreSQL queries, indexes, migrations, constraints, and transaction boundaries while preserving user data.
---

# TradeFix Database and Data Integrity

## Inspect before changing
Read the current models, migrations, ORM/repository conventions, existing constraints, and environment-specific database configuration. Do not assume table or column names from memory.

## Data safety
- Treat production data as valuable and potentially irreplaceable.
- Never drop, truncate, overwrite, or mass-update user data without an explicit task and a reviewed recovery plan.
- Prefer additive, backward-compatible migrations. For larger changes, use expand/migrate/contract sequencing.
- Include a rollback strategy where practical and document any migration that cannot safely be reversed.
- Keep schema changes consistent with all writers/readers, background jobs, imports, broker sync, reports, and tests.

## Query correctness and performance
- Parameterize user inputs; never concatenate raw inputs into SQL.
- Scope reads and writes to the authenticated user's authorized data.
- Use transactions for related writes and define failure handling explicitly.
- Add indexes based on real access patterns and query plans, not guesses. Consider tenant/account scope and common filters together.
- Paginate large datasets and avoid loading entire trade histories into memory unnecessarily.
- Watch for N+1 queries and expensive aggregates over unbounded ranges.
- Preserve monetary precision and timestamp/timezone semantics.

## Multi-tenant data
- Make user/tenant/account scope explicit in query functions and repository contracts.
- Test that one user cannot read, update, delete, or infer another user's records.
- Apply ownership checks to nested resources, exports, files, AI retrieval, background jobs, and broker connections—not just the top-level route.

## Migration workflow
1. Identify the data need and affected code paths.
2. Draft a minimal migration aligned with existing tooling.
3. Assess lock duration, backfill cost, null/default behavior, and old-client compatibility.
4. Update models/schemas and all relevant consumers.
5. Test migration on a representative disposable database if available.
6. Verify migration status and runtime queries. Never claim production migration success without actual evidence.
