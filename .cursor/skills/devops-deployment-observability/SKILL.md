---
name: devops-deployment-observability
description: Safely maintain TradeFix environment configuration, Docker workflows, CI/CD, cloud deployment, migrations, logging, monitoring, and operational runbooks.
---

# TradeFix DevOps, Deployment, and Observability

## Inspect the deployment reality
Read Dockerfiles, compose manifests, CI workflows, environment examples, deploy scripts, cloud configuration, health endpoints, and logging setup before changing operations. Never assume a provider, cluster, or production topology without evidence.

## Environment hygiene
- Keep development, staging, and production configuration distinct.
- Never commit live credentials, private keys, production dumps, or populated `.env` files.
- Maintain a sanitized `.env.example` when the project uses one.
- Validate required environment variables and use safe defaults only where appropriate.
- Avoid exposing admin/debug routes or verbose errors in production.

## Docker and builds
- Preserve multi-stage/build conventions and use deterministic dependencies/lockfiles.
- Run as a non-root user where practical; keep containers minimal and health checks meaningful.
- Avoid baking secrets into images or build layers.
- Confirm ports, persistent volumes, networks, and startup dependencies before altering compose files.

## Deployment safety
- Build and test before deployment.
- Use backward-compatible database migration sequencing when app versions overlap.
- Plan rollback for application and schema changes; don't assume database rollback is safe.
- Prefer health/readiness checks and verify the deployed version after release.
- Do not perform production deployment or destructive infrastructure changes without explicit authorization.

## Logs and monitoring
- Use structured, useful logs with timestamps, severity, correlation IDs, and safe context.
- Redact personal data, trade notes, credentials, tokens, and provider secrets.
- Avoid logging every success at high volume when selective operational events suffice.
- Monitor errors, latency, queue/job failures, broker sync, resource saturation, and database health according to the existing stack.
- Ensure alerts are actionable and don't include secrets.

## Final report
List changed configuration, commands actually executed, environment assumed, verification evidence, migration considerations, and rollback notes. Never claim a deployment happened unless it was actually performed.
