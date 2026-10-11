---
name: motion-animations
description: Implement consistent, performant, accessible page transitions and micro-interactions in TradeFix using existing CSS and Framer Motion where already installed.
---

# TradeFix Motion and Animations

## Audit
Inspect route layouts, persistent shell components, installed motion libraries, reduced-motion support, and existing animation patterns before implementation. The frontend has used Framer Motion 12; verify the actual dependency/version before relying on it.

## Motion principles
- Motion should explain hierarchy, state change, and continuity—not slow down work.
- Prefer opacity and transform for performant animations.
- Keep page transitions short and restrained; a fade with a small vertical rise is an appropriate default.
- Use small stagger delays only for stable groups that mount together.
- Avoid animating every table row, chart point, financial value, or text element.
- Never add arbitrary timeouts to simulate loading.

## Next.js navigation safety
- Animate route content, not the entire application shell.
- Don't key the layout, providers, sidebar, rail, or header by pathname.
- Keep query/filter/tab changes from remounting or replaying route entrance animations unless explicitly requested.
- Be careful with exit animations: avoid blank screens, delayed navigation, stale pages, portal/fixed-position bugs, and duplicated mounts.
- Preserve browser history, deep links, and scroll behavior.

## Micro-interactions
- Use existing Button/Card/Popover/Dialog patterns rather than building a competing motion system.
- Animate hover and press subtly. Don't lift all dashboard cards if it causes rows to misalign.
- Keep dropdown origins anchored to their triggers.
- Preserve dismissal, focus trapping/restoration, Escape behavior, and click-outside behavior for overlays.

## Accessibility and performance
- Respect `prefers-reduced-motion` for route, section, menu, rail, and control movement.
- In reduced-motion mode, remove travel/scale and keep state changes understandable.
- Clean up listeners and animation controls. Avoid layout thrashing and unnecessary re-renders.
- Don't change chart library animation settings or animated financial number behavior without an explicit requirement.

## Validation
Test route navigation, back/forward, query-only changes, repeated clicks, mobile layouts, overlays, and reduced motion. Report what was tested and any limitations.
