---
name: forms-validation-workflows
description: Build dependable TradeFix forms for add/edit trades, settings, broker connections, imports, filters, and other workflows with validation, error handling, and accessible feedback.
---

# TradeFix Forms and Validation

## Form behavior
- Inspect existing form components, validation library, schema definitions, server error format, and reset/dirty-state conventions.
- Use a single clear source of truth for form values and validation where possible.
- Keep labels, helper text, required indicators, and errors consistently positioned.
- Preserve entered data after recoverable server errors; don't clear forms unexpectedly.
- Prevent accidental double submission while keeping retry possible after failures.

## Validation
- Validate on the client for helpful feedback and validate again on the server for correctness/security.
- Distinguish required, optional, nullable, and defaulted fields.
- Normalize input conservatively; do not silently rewrite financial values or user text.
- Display field-level errors when possible and a clear summary for broader failures.
- Avoid validating every keystroke in a way that disrupts entry.

## Trade-entry specifics
- Preserve existing fields, column names, execution behavior, deep-entry functionality, and auto-calculation rules unless the request explicitly changes them.
- Make dependencies among side, instrument, size, entry/exit prices, fees, and dates clear.
- Distinguish values the user entered from values calculated by the application.
- Validate numeric ranges and precision according to the existing domain model.
- Prevent duplicate submissions and avoid losing unsaved user input during rerenders or navigation.

## Server interaction
- Handle validation errors, network errors, timeouts, authorization failures, and conflicts distinctly.
- Do not treat an HTTP error as successful submission.
- Refresh or invalidate affected data using established state/query patterns.
- Ensure success messages only appear after confirmed server success.

## Accessibility and tests
- Associate errors with fields, maintain keyboard navigation and focus, and use correct input types.
- Test valid submission, invalid inputs, server errors, double click, reset/cancel, and edit existing records.
