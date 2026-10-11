---
name: frontend-nextjs
description: Implement and debug TradeFix frontend features using the existing Next.js App Router, React, TypeScript, routing, server/client component boundaries, and frontend conventions.
---

# TradeFix Frontend Engineering (Next.js App Router)

## Before coding
- Inspect `package.json`, the app directory, route groups, layouts, middleware, shared components, API client, styles, and testing scripts.
- Confirm Next.js and React versions from the lockfile/package manifest; do not assume APIs from older tutorials.
- Trace where data originates and whether a page is a Server Component or Client Component.

## Architecture
- Prefer Server Components for server-rendered content and data access where the existing architecture supports it.
- Add `"use client"` only when state, effects, event handlers, browser APIs, or client-only dependencies require it.
- Keep client boundaries narrow. Never import server-only modules into client components.
- Keep persistent shell elements (providers, rail, sidebar, header) mounted during page navigation when the established architecture expects them to persist.
- Use the established routing conventions. Do not add duplicate pages, routes, loading files, or data-fetch layers without checking what already exists.
- Use typed props and domain types; avoid `any`, unsafe casts, and duplicated interface definitions.

## UI and state
- Reuse shared buttons, inputs, cards, dialogs, popovers, tables, badges, and layout primitives.
- Keep URL state for shareable filters, tabs, pagination, and sorting where that is already the product convention.
- Distinguish loading, empty, error, stale, and success states. Do not silently swallow failed requests.
- Prevent stale asynchronous responses from overwriting newer state. Avoid redundant requests and effects that mirror derived state.
- Preserve form values and modal state according to the current UX; don't reset state accidentally through remounting.
- Ensure list keys are stable and reflect identity, not array indexes when items can reorder.

## Routing and navigation
- Preserve deep links, query parameters, browser back/forward, redirects, and authentication guards.
- Read dynamic route params using the API supported by the installed Next.js version.
- Do not key the entire layout or providers by pathname.
- Keep route-level transitions separate from local tab/filter animations. Query-only changes should not unintentionally remount entire pages.

## Styling and responsiveness
- Follow the project's current styling system (CSS Modules, Tailwind, or existing conventions); do not mix approaches casually.
- Use semantic tokens rather than hardcoded theme-specific colors.
- Build from mobile/narrow widths up to desktop; check overflow, sticky elements, sidebar behavior, focus visibility, and chart resizing.
- Use semantic HTML, proper labels, and accessible controls.

## Quality checks
- Use the repository's actual scripts for lint, type checking, tests, and production build.
- Fix warnings or errors introduced by the change. Distinguish pre-existing failures from new ones.
- Verify the affected route at desktop and narrow widths when browser tools are available.
