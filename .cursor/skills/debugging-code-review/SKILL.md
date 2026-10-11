---
name: debugging-code-review
description: Find root causes and review changes in TradeFix with evidence-driven debugging, small fixes, regression tests, and maintainability-focused code review.
---

# TradeFix Debugging and Code Review

## Debug systematically
1. Reproduce or narrow the issue using a clear expected-versus-actual description.
2. Read the relevant stack trace, network request, logs, route, component, service, and recent changes.
3. Trace the data/state path from user action to UI, API, persistence, background job, or provider as applicable.
4. Identify the root cause and verify it with a focused hypothesis or test.
5. Implement the smallest complete fix and add regression coverage.

## Avoid symptom-only fixes
- Don't hide errors, swallow exceptions, add arbitrary waits, hardcode fake values, or disable validation to make the UI appear correct.
- Don't rewrite a subsystem before confirming the defect lies there.
- Check async race conditions, stale state, lifecycle/cleanup issues, timezone handling, duplicate requests, transaction boundaries, and authorization scope where relevant.
- Distinguish a code regression from configuration, environment, external-provider, or pre-existing test failures.

## Review checklist
- Correctness and edge cases.
- Security and access control.
- Data integrity and migrations.
- Error handling, timeouts, and retry semantics.
- Type safety and API compatibility.
- Accessibility and responsive behavior for UI changes.
- Performance and unnecessary complexity.
- Test coverage and documentation.
- No secrets, generated noise, unrelated refactors, or weakened tests.

## Findings format
Prioritize issues by severity and include file/line references when available, impact, reproduction conditions, and a concrete fix. Lead with actionable findings, not stylistic preferences. If no issue is found, state the scope of what was actually reviewed and any coverage limitations.

## Completion
Run relevant checks and report the actual results. Never say a bug is fixed solely because code was edited; tie the conclusion to a test, reproduced scenario, or clearly stated unverified status.
