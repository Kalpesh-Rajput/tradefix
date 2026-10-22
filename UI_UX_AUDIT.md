# TradeFix Signature UI — UI/UX Audit

Status legend: **Done** (implemented and verified), **Partial** (implemented for shared layer / some screens), **Deferred** (documented, not implemented in this pass).

Priority legend: **P0** broken / inaccessible / serious layout failure · **P1** important inconsistency, missing feedback, common responsive issue · **P2** polish.

---

## 0. Stack (verified from the repository)

| Area | Actual implementation |
|---|---|
| Framework | Next.js 16.3 App Router, React 19, TypeScript 5.7, Turbopack dev |
| Styling | Tailwind CSS 3.4 + `app/globals.css` (≈1.7k lines). Colors are CSS variables: hex `--color-*` and HSL-channel `--background`, `--primary`, … consumed by Tailwind as `hsl(var(--x) / <alpha>)` |
| Theme engine | `lib/theme-registry.ts` — 12 presets (hex is source of truth, HSL derived), boot script in `<head>` sets variables before paint, `AppearanceProvider` persists to the user profile, custom themes (`ct_*`) via `CustomThemeStudio`. Backend allow-lists preset ids in `backend/app/schemas/auth.py` and `custom_theme.py`. Contrast checked by `scripts/test-themes.ts` |
| Fonts | `next/font` Inter (UI) + Playfair Display (brand lockup) |
| Icons | `lucide-react` everywhere (no second icon family) |
| Animation | `framer-motion` 12 (43 files), plus CSS keyframes (`page-enter`, `menu-enter`, `overlay-*`) |
| Charts | Recharts 2 (dashboard/reports), `lightweight-charts` 5.2 (replay, backtest desk) |
| Data | TanStack Query 5, Zustand 5, react-hook-form + zod 4 |
| Primitives | Hand-written: `components/ui/{Button,Input,Card,Badge,Skeleton,Toast,InfoTooltip,SearchableSelect,RangeCalendarDialog,ThemeToggle}`. No Radix/shadcn |
| Toasts | Custom `ToastProvider` (framer-motion, portal, `aria-live`) |
| Tests | 15 `tsx` assertion scripts (`npm test`), Playwright e2e (`e2e/`), `tsc --noEmit`, `next lint` |

Decision: extend the existing token engine, Tailwind config, lucide, and framer-motion. No competing styling or animation library is introduced.

## 0.1 Route inventory (64 route/layout files)

Shell: `app/(app)/layout.tsx` → `ProductRail` (64px rail, hover-expand) + journal `Sidebar` (188px) + `AppHeader` + `PageTransition` + `MobileNav` drawer.

| Group | Routes |
|---|---|
| Public / auth | `/` (landing), `/login`, `/signup`, `/onboarding` |
| Home | `/home` |
| Journal hub | `/today` (dashboard), `/day`, `/trades`, `/trades/new`, `/trades/[id]`, `/notebook`, `/diary`, `/my-day`, `/journal`, `/journal/new`, `/journal/[id]`, `/calendar`, `/analytics`, `/progress-tracker`, `/playbooks`, `/playbooks/[id]`, `/trading-plan`, `/mindset`, `/news`, `/portfolio`, `/market-sessions` |
| AI | `/tradefiz-ai`, `/tradefiz-ai/chat/[[...id]]`, `/chat`, `/ai-review`, `/agents`, `/coach` |
| Replay | `/replay/[tradeId]`, `/replay/run/[runId]/[seq]`, `/replay/session/[sessionId]/[tradeId]` |
| Backtesting | `/backtest`, `/backtest/sessions/new`, `/backtest/sessions/[id]` (chart desk), `/backtest/runs/[id]`, `/backtest/strategies/new`, `/backtest/strategies/[id]` |
| Settings | `/settings`, `profile`, `accounts`, `broker`, `prop-firm`, `trading-defaults`, `masters`, `goals`, `coaching`, `notifications`, `subscription`, `appearance`, `system`, `support` |
| Other | `/notices`, `/perks`, `/wiki`, `/admin/data-status` |

## 0.2 Codebase-wide measurements (before changes)

| Signal | Count | Notes |
|---|---|---|
| `.tsx` files in `components/` + `app/` | 458 | |
| Files with hard-coded hex in class names (`[#xxxxxx]`) | 44 (259 occurrences) | Patched at runtime by ≈250 lines of `html.dark .bg-\[#…\]` / `html.light .text-zinc-…` `!important` overrides in `globals.css` |
| Files using `zinc-*` utilities | 32 | Same override layer |
| `window.confirm` / `window.alert` | 15 calls in 12 files | Unstyled, blocks the main thread, inconsistent with the product |
| Files rendering `role="dialog"` | 32 | Each hand-rolls backdrop, Escape, focus; no shared dialog primitive |
| Files with native `<select>` | 33 | Native popup ignores theme in some browsers |
| `title=` tooltips | 359 | Native tooltips only: no keyboard-focus support, delayed, unstyled |
| Emoji / glyphs used as UI icons | 6 files | `✓`, `☐`, `🧠`, `📘`, section-label emoji in AI messages |

---

## 1. Findings by area

### 1.1 Design tokens and theme (shared)

- **P0 — Focus ring nearly invisible.** `*:focus-visible { box-shadow: var(--focus-ring) }` where the default theme's ring is `0 0 0 2px #5B469626` (15% alpha). Keyboard users cannot see focus on most controls.
- **P1 — No dedicated premium dark theme.** Dark presets exist (Midnight Pro, Obsidian Gold) but none matches the Signature palette (layered `#0B0D14 → #11141E → #171B29` surfaces, violet accent, restrained champagne). "Follow device" resolves to Midnight Pro / Classic.
- **P1 — No motion, z-index, or control-height tokens.** Durations are ad hoc (`140ms`, `160ms`, `200ms`, `220ms`, `280ms`, `0.3s`), easing differs per file, z-indexes range from `z-10` to `z-[100]` without a scale.
- **P1 — Tabular numerals only opt-in** via `.font-mono-data`; table cells and KPI values in many places use proportional digits so columns jitter.
- **P2 — Override layer.** `html.light .text-white…` / `html.dark .bg-\[#F7F7F9\]` `!important` rules are a maintenance hazard. Kept (removing them safely requires per-file migration) — see Deferred.

### 1.2 Icons

- **P1 — Journal sidebar uses 13 different icon hues** (`#7C5CBF`, `#F59E0B`, `#EC4899`, `#10B981`, …) in the default theme. Reads as a template, competes with P&L green/red, and conflicts with the "purple for chrome only" rule.
- **P1 — Profile fallback shows the TradeFix logo** inside a black circle instead of the user's initials.
- **P2 — Emoji/glyph icons** (`✓` in TradingGoals, `☐` in TemplateDetailModal, `🧠` in MindsetCheckin, AI section labels 📊💡🎯📰). Mood emoji in RecapForm are data labels, not chrome — kept.
- **P2 — Stroke widths vary** (1.75 / 2 / 2.25 / 2.5) without a rule.

### 1.3 Shell: rail, sidebar, header, profile, notifications

- **P1 — Active indicators jump.** Rail uses a solid fill, sidebar uses an inset box-shadow; neither animates between items.
- **P1 — Notification menu** has no Escape handling, no `aria-expanded`, uses `shadow-sm` (looks flat next to other menus), hard-coded English strings, no unread count, instant show/hide.
- **P1 — Profile menu** has no keyboard arrow navigation, does not move focus into the menu or restore it, no appearance shortcut, no plan indicator.
- **P1 — Header mobile menu button** uses `hover:bg-black/[0.05]` (invisible in dark themes).
- **P1 — Mobile drawer** appears without transition and does not move focus into the drawer.
- **P2 — App boot loader** is a pulsing ring with `text-zinc-500`.

### 1.4 Shared components

| Component | Findings |
|---|---|
| `Button` | **P1** no loading state (callers hand-roll spinners, 21 files with `animate-spin`); no size tokens; `transition-all` animates layout properties |
| Icon-only buttons | **P1** no shared `IconButton`; each sets its own size/hover/label; tooltips are native `title` |
| `Input` / `Label` | **P0** `Label` accepts only `children` — it cannot be associated with an input (`htmlFor`), so screen readers do not announce field names where it is used. **P1** inconsistent heights (`py-2` vs `h-8/h-9`), no invalid styling unless `aria-invalid` is set manually |
| Toggles | **P1** three hand-written `role="switch"` implementations with different track sizes; no shared `Switch` |
| Confirmations | **P1** `window.confirm` in broker disconnect, notebook folders, trade notes, recap delete, strategy delete, run delete, account delete, day notes, My Day notes |
| Toast | **P1** no warning variant; identical toasts stack (double-submit / refetch); errors announced politely instead of assertively |
| Tooltip | **P1** only `InfoTooltip` (info glyph). No general tooltip for icon-only controls |
| Dialogs | **P1** 32 bespoke implementations. Most handle Escape; focus trap / restoration is inconsistent. Shared `Dialog` primitive introduced for new work (ConfirmDialog); migration of the 32 existing dialogs deferred |
| Skeleton | OK — shimmer respects reduced motion |

### 1.5 Scrollbars and scrolling

- **P1 — Five different scrollbar recipes** (`::-webkit-scrollbar` 6px global, 4px sidebar, 8–10px trade log, 10px insight charts, 14px with 5px border on dashboard panes). Global thumb has no hover state and no Firefox `scrollbar-color` at root level.
- **P2 — No fade affordance** for horizontally scrolling toolbars/tabs.
- OK — no global smooth scrolling, no scroll hijacking; chart desks use `overflow-hidden` correctly.

### 1.6 Pages (summary)

| Area | Key findings | Priority |
|---|---|---|
| Auth (`/login`, `/signup`) | Animated blobs loop continuously (respect reduced motion already) | P2 |
| Onboarding | Footer shows unverified marketing stats ("10k+ Active Traders", "4.8★ 800+ Reviews", "20.5B+ Trades Journaled", "#1 Trading Journal App"). Not traceable to data; legal/trust risk for a paid product. **Not changed** — needs product decision | P1 |
| Dashboard `/today` | Well-structured container-query grid. Inherits sidebar/indicator/tabular-number fixes | P2 |
| Trade log `/trades` | Good sticky header and scroll; confirm dialogs native | P1 |
| Notebook / Day / My Day | Native confirms for template replace and delete; `window.alert` for voice input | P1 |
| Analytics / Reports | Many hex hard-codes; relies on override layer | P2 |
| Backtesting desk, Replay | lightweight-charts lifecycle tested (`test-chart-lifecycle`, `test-replay-engine`). Must not be wrapped in additional transitions. Native confirm for run/strategy delete | P1 |
| Settings | Three different switch implementations; account deletion uses native confirm | P1 |
| Broker connect | Disconnect uses native confirm | P1 |
| AI (TradeFiz) | Emoji section labels; otherwise consistent | P2 |

### 1.7 Accessibility

- P0 focus ring (above), P0 `Label` association (above).
- P1 icon-only controls rely on `title` for their only visible hint.
- P1 notification and profile menus lack full menu keyboard semantics.
- OK `prefers-reduced-motion` handled for CSS keyframes; framer-motion components do not consistently check it.

### 1.8 Performance

- Page transitions are CSS (no JS cost) and keyed by path only — good; query/hash changes do not remount.
- Rail uses `transition-[width]` on an absolutely positioned overlay — does not reflow main content. OK.
- No large animation assets; no Lottie. Keep it that way.

---

## 2. Implementation log

No packages were installed. Icons stay on `lucide-react`; motion stays on `framer-motion` 12 plus CSS keyframes. No Lenis, no global smooth scrolling, no hidden scrollbars.

### 2.1 Design system (Phases 1, 4, 6)

| Item | Status | Where |
|---|---|---|
| Signature Dark / Signature Light presets (WCAG AA verified by `test-themes.ts`). Dark accent `#8B6CF6` uses dark foreground text because white measured 3.77:1 | Done | `lib/theme-registry.ts`, backend `schemas/auth.py`, `schemas/custom_theme.py` |
| Follow device now resolves to Signature Light / Dark | Done | `FOLLOW_DEVICE_LIGHT/DARK` in `theme-registry.ts`, boot script, settings copy |
| Champagne tokens (`--color-champagne`, `.tf-champagne`, `.tf-champagne-chip`), gradient hairline (`.tf-hero-card`) | Done (tokens) / Partial (used on plan chip only) | `globals.css`, `tailwind.config.ts` |
| Motion tokens (`--ease-out`, 140/200/260ms), `MOTION` presets, `reducedPreset`, `MotionConfig reducedMotion="user"` | Done | `lib/motion.ts`, `providers/MotionProvider.tsx` |
| Z-index scale (header 10 → tooltip 500, above the existing `z-[90…230]` modals) | Done | `globals.css`, `tailwind.config.ts` |
| Control heights, tabular numerals on `td/th/time/.tf-num/[data-numeric]` | Done | `globals.css` |
| Focus ring: 2px solid ring at 85% (was 15% alpha box-shadow) | Done (P0) | `globals.css` |
| Unified scrollbar: 10px hit area, hover/active thumb, Firefox fallback, `.tf-scroll-fade-x` | Done | `globals.css` |
| Default theme for existing users | Unchanged (`tradefix-purple`) — users opt in | |

### 2.2 Shared components (Phases 3, 5, 10)

| Component | Status |
|---|---|
| `ui/Spinner`, `ui/Tooltip` (portal, 350ms delay, instant on keyboard focus, Escape/scroll dismiss), `ui/IconButton` (required label), `ui/Switch`, `ui/Avatar` (initials fallback), `ui/Dialog` (focus trap, Escape, scroll lock, focus restore, `layer`), `ui/ConfirmDialog` (`useConfirm()` → `Promise<boolean>`) | New |
| `Button` — `loading` state with stable width, `aria-busy`, explicit transition properties | Done |
| `Toast` — warning variant, de-duplication (1.5s), assertive errors, per-variant duration, above modals | Done |
| `Input` / `Label` — `htmlFor`, `required` marker, `FieldError`, hover/focus/invalid/disabled styles | Done (P0) |
| `ThemeToggle` — tooltip, animated icon swap, Escape restores focus | Done |

### 2.3 App shell (Phase 7)

| Surface | Change | Status |
|---|---|---|
| `ProductRail` | Animated shared-layout active pill (`layoutId`), icon hover scale | Done |
| `Sidebar` | Monochrome icons via `--color-sidebar-icon`; animated active pill with glowing left bar; Add Trade micro-interaction | Done |
| `RailProfile` | Initials avatar, arrow/Home/End keyboard nav, focus in/out, Appearance shortcut, plan chip | Done — verified in browser |
| `NotificationBell` | Tooltip, unread badge, bell ring on new items, loading/error/empty states, Escape/outside close | Done — verified in browser (empty state) |
| `MobileNav` | Animated drawer with scrim, `aria-modal`, focus moves in and returns to opener, fits 360px | Done — verified at 360px |
| `AppHeader` | Theme-safe hover on mobile menu button, `aria-expanded` | Done |
| App boot loader | `Spinner` + `role="status"` | Done |

### 2.4 Native dialogs replaced (Phase 10)

All 15 `window.confirm` / `window.alert` calls now use `useConfirm()` or `toast.warning`: broker connect screen and wizard, notebook folders, notebook page guard, trade notes tab, recap form, strategy form, backtest runs list (now also shows success/error toasts and disables while deleting), accounts settings, day note editor (template, close, delete), My Day notes, rich note editor voice input.

### 2.5 Pages and content (Phase 8)

- Emoji UI icons replaced with lucide: `AiMessage` section labels, `TradingGoals`, `MindsetCheckin`, `TemplateDetailModal`.
- `PlaybookFormModal`: all 10 labels associated with their inputs.
- `HourlyWinRateChart`: added the missing React `key` on custom dots (console error on `/today`). Rendering and data unchanged.
- Every other page inherits tokens, focus, scrollbars, shell, and tabular numerals but was **not individually redesigned** in this pass (see 3.3).

### 2.6 Charts (Phase 9)

No chart component was wrapped in a new transition, and no calculation, precision, or data path was changed. `test-chart-lifecycle`, `test-replay-engine`, `test-replay-overlays`, and `test-order-engine` all pass. The replay and backtest desks were **not** opened in the browser during this pass.

---

## 3. Final report (Phase 16)

### 3.1 Checks actually run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm test` (15 tsx suites incl. themes, motion, chart lifecycle, replay, order engine) | Pass |
| `npm run build` (Next 16 production build, all routes) | Pass |
| `npm run lint` | **Not runnable.** The script calls `next lint`, which Next 16 removed, and ESLint is not installed in `frontend/package.json`. Pre-existing |
| Playwright e2e (`e2e/`) | **Not run** |
| Backend tests | **Not run** (only the theme allow-lists changed) |

Browser checks on the running dev server: Signature Dark and Light on `/settings/appearance`, `/home`, `/today`; profile menu open, Escape, and focus restore; notification bell empty state; journal sidebar active pill; mobile drawer at 360px (fits, focus in and out, no horizontal overflow). **Not seen in the browser:** the confirm dialog (every trigger is a destructive action on real data), tooltips on hover, 390/768/1920 widths, reduced-motion mode, replay and backtest chart desks, auth and onboarding pages.

### 3.2 Completed

Design tokens, two Signature themes, motion presets, z-index scale, focus ring, scrollbars, tabular numerals, nine shared primitives, shell (rail, sidebar, profile, notifications, mobile drawer, header), native-dialog replacement, emoji icon replacement, label association.

### 3.3 Partial

- `IconButton` / `Tooltip` adopted in the shell only; 359 native `title=` tooltips remain across pages.
- `.tf-hero-card` and champagne accents defined but used only on the plan chip.
- Per-page redesign: pages inherit the shared layer; no page-specific layout work.

### 3.4 Deferred

- Migrating the 32 bespoke dialogs to `ui/Dialog`.
- Removing the `!important` hex/zinc override layer (44 files, 259 hex values) — needs per-file token migration.
- Replacing 33 native `<select>` elements.
- Migrating the three hand-written switches (`SettingsShell`, `EditRulesModal`, `AgentsWorkspace`) to `ui/Switch`.
- `TemplatePreview.tsx` `📘` fallback glyph.
- Onboarding marketing stats in `OnboardingShell.tsx` — needs a product decision; left unchanged.
- `components/trades/TradeForm.tsx` is unused (dead code); left in place.
- Restoring a working lint setup (install ESLint + flat config, replace `next lint`).

### 3.5 Changed files

Created: `UI_UX_AUDIT.md`, `frontend/components/providers/MotionProvider.tsx`, `frontend/components/ui/{Avatar,ConfirmDialog,Dialog,IconButton,Spinner,Switch,Tooltip}.tsx`.

Modified:
- Backend: `backend/app/schemas/auth.py`, `backend/app/schemas/custom_theme.py`
- Docs: `docs/theming.md`
- Foundation: `frontend/app/globals.css`, `frontend/tailwind.config.ts`, `frontend/lib/theme-registry.ts`, `frontend/lib/motion.ts`, `frontend/app/layout.tsx`, `frontend/app/(app)/layout.tsx`
- Tests: `frontend/scripts/test-themes.ts`, `frontend/scripts/test-motion.ts`
- UI primitives: `frontend/components/ui/{Button,Input,Toast,ThemeToggle,ThemeChoices}.tsx`
- Shell: `frontend/components/layout/{AppHeader,MobileNav,NotificationBell,ProductRail,RailProfile,Sidebar}.tsx`
- Features: `ai/AiMessage.tsx`, `backtest/results/RunsList.tsx`, `backtest/strategy/StrategyForm.tsx`, `broker/BrokerConnectScreen.tsx`, `broker/BrokerConnectWizard.tsx`, `dashboard/MindsetCheckin.tsx`, `dashboard/TradingGoals.tsx`, `dashboard/analytics/HourlyWinRateChart.tsx`, `dayview/notes/DayNoteEditor.tsx`, `dayview/notes/RichNoteEditor.tsx`, `journal/RecapForm.tsx`, `my-day/MyDayNotesCard.tsx`, `notebook/NotebookFolders.tsx`, `notebook/NotebookPage.tsx`, `playbooks/PlaybookFormModal.tsx`, `playbooks/TemplateDetailModal.tsx`, `settings/AccountsSettingsPage.tsx`, `settings/AppearanceSettingsPage.tsx`, `trades/preview/NotesTab.tsx` (all under `frontend/components/`)
