---
name: analytics-data-visualization
description: Design, implement, and validate TradeFix dashboards, reports, performance metrics, charts, filters, and analytics views with accurate and accessible data presentation.
---

# TradeFix Analytics and Data Visualization

## Data integrity first
- Find the source query/service and canonical metric implementation before changing chart UI.
- Never fabricate placeholder production data or silently replace missing values with zero.
- Make data ranges, timezone, currency, aggregation period, and metric units explicit when they affect interpretation.
- Ensure dashboard totals and detailed reports use compatible definitions and filters.
- Avoid mixing accounts, instruments, or currencies without a documented grouping/conversion rule.

## Chart selection
- Choose a chart type based on the comparison or question, not decoration.
- Use readable axis labels, appropriate tick density, honest zero/baseline choices, tooltips with units, legends with clear series names, and sensible sorting.
- Avoid 3D charts and misleading scales.
- Use horizontal bars for long category labels, lines for meaningful time sequences, and tables when exact values matter more than visual patterns.
- Do not use color as the only distinction between series or outcomes.

## Filters and interactions
- Keep chart controls, date range, account, symbol, session, timeframe, and strategy filters in sync with underlying data.
- Preserve URL filter state if that is an existing product convention.
- Debounce expensive query inputs when appropriate and avoid duplicate fetches.
- Updating a filter should update data without unnecessarily remounting the route or replaying all entrance animations.
- Provide meaningful loading, empty, error, and partial-data states.

## Trading analytics
- Check treatment of closed/open trades, partial exits, fees, timezone boundaries, and selected account before altering aggregates.
- Label net versus gross P&L clearly.
- Ensure win rate and sample size are shown in context; avoid implying small samples are conclusive.
- Handle zero trades, zero denominator, negative results, and long date ranges gracefully.
- Keep chart tooltips, summary cards, tables, exported reports, and AI analysis consistent.

## Validation
Add or update tests for the underlying aggregation logic where practical. Test no-data and edge cases and confirm that the chart renders responsively in the project's chart library.
