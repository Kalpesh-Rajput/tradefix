---
name: design-system-theming
description: Build and maintain TradeFix design tokens, reusable components, and coordinated light/dark/accent themes across pages, charts, menus, and forms.
---

# TradeFix Design System and Themes

## Audit first
Find the existing theme provider, CSS variables, Tailwind config, component variants, theme persistence, and chart color configuration. Extend the system that exists instead of introducing a second one.

## Token strategy
Use semantic tokens for roles, not component-specific raw colors. Include as needed:
- App/page background; primary, secondary, and elevated surfaces.
- Primary/secondary/muted text and inverse text.
- Default/subtle/strong borders.
- Accent/default/hover/active/focus colors.
- Positive, negative, warning, info, and neutral statuses.
- Focus ring, overlay, shadow, and chart-series tokens.

Each theme must define the same semantic token contract. Choose values based on readability and contrast, not only aesthetics.

## Theme behavior
- Apply a selected theme consistently to the shell, pages, cards, inputs, dropdowns, tooltips, dialogs, toasts, scroll areas, tables, and charts.
- Persist preferences using the existing settings mechanism; if local persistence is used, prevent hydration flashes and account for SSR.
- Avoid duplicate theme controls and conflicting sources of truth.
- Ensure theme changes do not trigger page reloads or reset unrelated application state.
- Respect system preference for the initial default if that matches current behavior; don't override a saved user preference.

## Charts and third-party components
- Pass token-derived colors to chart libraries where supported.
- Verify axes, gridlines, crosshairs, legends, tooltips, selection, and empty/loading states in every theme.
- Don't theme only chart backgrounds while leaving labels with low contrast.

## Governance
- Remove or replace hardcoded colors only within the scope of the requested change; avoid unrelated churn.
- Keep positive/negative financial conventions stable across themes unless a deliberate, accessible redesign is requested.
- Avoid excessive neon or gradients and ensure contrast is adequate.
- Document new tokens and provide a sensible default/fallback for missing tokens.
