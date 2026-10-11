---
name: import-export-files
description: Build robust TradeFix trade import/export workflows for CSV, Excel, XML, and other explicitly supported formats, including header matching, preview, validation, and safe failure handling.
---

# TradeFix Import and Export

## Import workflow
Use a staged pipeline:
1. Validate file type, size, encoding, and basic structure.
2. Parse safely using established libraries already present.
3. Normalize column names (case, whitespace, punctuation, known aliases) while retaining original headers for preview.
4. Map headers to canonical fields using explicit alias tables and conservative matching.
5. Show a preview and allow users to resolve ambiguous mappings when the UX supports it.
6. Normalize dates, timezone, decimal separators, currencies, side, symbol, quantities, and IDs.
7. Validate each row and report row-level errors without silently dropping data.
8. Preview create/update/skip counts where feasible, then persist in bounded transactional batches.
9. Return a precise import summary with success, skipped, and failed rows.

## Mapping correctness
- Do not map fields based on fuzzy similarity alone when the result could change financial meaning.
- Distinguish entry price, exit price, quantity, commission, gross P&L, net P&L, order ID, and trade ID.
- Respect partial executions and the existing canonical trade model.
- Do not assume date formats, locale, decimal separators, timezone, or base currency.
- Handle duplicate files and repeated rows idempotently according to the product's existing rules.

## Security
- Enforce upload size and parser limits. Reject unsupported types and malformed files clearly.
- Treat CSV, XML, and spreadsheet contents as untrusted input.
- Avoid XML external entity (XXE) behavior; use a safe parser configuration.
- Do not execute formulas/macros or load external workbook links.
- Prevent path traversal and temporary-file leakage.
- Escape exported CSV values that could trigger spreadsheet formula execution when opened in spreadsheet software.
- Authorize all imported records to the current user/account.

## Export workflow
- Export only authorized rows and honor selected filters/time ranges.
- Include clear column names, units, timezone, and currency metadata where appropriate.
- Stream or chunk large exports instead of building unbounded files in memory.
- Handle empty results, large datasets, and failure cleanup.
- Ensure exports cannot leak other users' records or secrets.

## Tests
Use fixtures for alternate header names, missing columns, malformed rows, duplicate imports, timezone edge cases, Excel/CSV/XML parsing, formula injection, large files, and partial failures.
