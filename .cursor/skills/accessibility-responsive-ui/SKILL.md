---
name: accessibility-responsive-ui
description: Audit and improve TradeFix accessibility, keyboard navigation, screen-reader semantics, focus handling, reduced motion, contrast, and responsive layouts.
---

# TradeFix Accessibility and Responsive UI

## Inspect current behavior
Review semantic markup, shared components, focus styles, modal/popover primitives, keyboard handlers, breakpoints, and theme contrast before editing.

## Semantics and input
- Use native buttons for actions, links for navigation, and correct headings/landmarks.
- Associate form labels, descriptions, errors, and required state with controls.
- Provide accessible names for icon-only buttons and informative chart controls.
- Use correct table semantics and header associations for tabular data.
- Don't use clickable `div` elements when a semantic control is appropriate.

## Keyboard and focus
- Ensure all interactive controls are reachable and operable by keyboard.
- Keep focus visible and restore focus after dialogs/drawers close.
- Respect Escape and expected arrow/tab-key behavior for menus and dialogs.
- Prevent keyboard traps except intentional, correctly implemented modal focus management.
- Don't remove native focus outlines without a clear replacement.

## Visual accessibility
- Maintain sufficient contrast across every theme and state.
- Never communicate win/loss, status, or validation using color alone.
- Support zoom and text resizing without clipped controls or essential information.
- Use meaningful alt text for informative images; decorative imagery should not create noise.
- Provide text summaries or accessible labels for key chart information when feasible.

## Motion and responsive layouts
- Respect `prefers-reduced-motion` across route transitions, reveals, drawers, and controls.
- Check keyboard/touch access and appropriate hit areas.
- Test narrow screens for overflowing tables, clipped dialogs, hidden actions, and horizontal page scroll.
- Ensure sticky headers/sidebars don't cover focused controls or anchor targets.
- Preserve access to critical trading actions on mobile.

## Validation
Use existing accessibility tooling if present, plus manual keyboard checks and narrow-width inspection. Report automated findings and manual checks separately.
