# TradeFix themes

TradeFix has one appearance system. Presets live in `frontend/lib/theme-registry.ts`. `frontend/lib/appearance.ts` applies them, and `AppearanceProvider` saves the choice.

## Presets

| Id | Name | Mode |
| --- | --- | --- |
| `signature-dark` | Signature Dark | Dark. TradeFix Signature UI: layered graphite surfaces, `#8B6CF6` accent with dark labels, champagne highlights. |
| `signature-light` | Signature Light | Light. Porcelain workspace with graphite sidebar. |
| `tradefix-purple` | Original TradeFix Purple | Light. Default when nothing is saved. |
| `classic` | TradeFix Classic | Light. |
| `midnight-pro` | Midnight Pro | Dark. Unchanged palette. |
| `ocean-blue` | Ocean Blue | Light. |
| `forest-green` | Forest Green | Light. |
| `amethyst` | Amethyst | Light. |
| `warm-sand` | Warm Sand | Light. |
| `obsidian-gold` | Obsidian Gold | Dark. Separate from Midnight Pro. |
| `emerald-luxe` | Emerald Luxe | Light. |
| `burgundy-champagne` | Burgundy Champagne | Light. |
| `violet-aurora` | Violet Aurora | Light. Vibrant purple with luminous lavender accents. |
| `electric-spectrum` | Electric Spectrum | Light. Vibrant blue-to-violet gradients with luminous magenta accents. |

`system` is not another palette. It is Follow device: Signature Light when the operating system prefers light, Signature Dark when it prefers dark (`FOLLOW_DEVICE_LIGHT` / `FOLLOW_DEVICE_DARK`). It updates when the OS appearance changes. It does not select Obsidian Gold.

## Tokens

Each preset stores canonical `#RRGGBB` values for surfaces, text, borders, primary actions, inputs, sidebar, tables, tooltips, status colors, and charts.

Tailwind utilities such as `bg-background` and `text-primary` read `hsl(var(--token) / <alpha-value>)`. Those variables are HSL channels (`243 75% 59%`), derived from the hex by `hexToHslChannels`. Do not put a hex color in a channel variable.

`--color-*` variables hold the same hex for inline styles, Recharts, and existing `var(--color-text-primary)` call sites. Chart series use `--color-chart-profit`, `--color-chart-loss`, `--color-chart-line`, and `--color-chart-series`. Small profit and loss text uses `--color-success-text` and `--color-danger-text`, not the pale bar fills.

`applyAppearanceToDocument` and the boot script in the root layout both use `PRESET_CSS_VARIABLES` from the registry.

Violet Aurora keeps profit green and loss red. Its primary actions use `--aurora-gradient` (`linear-gradient(135deg, #5B21B6 0%, #7C3AED 55%, #9333EA 100%)`). Hover adds `--aurora-glow`. Those variables are set only for `violet-aurora`. Active navigation and pressed toggles use the lavender selected surface. Card shadows and the focus ring for that preset are in its chrome tokens. `prefers-reduced-motion` disables the extra color transitions.

Electric Spectrum keeps profit green and loss red. Its brand gradient is `--spectrum-gradient` (`linear-gradient(100deg, #0060FF 0%, #6830FF 50%, #CC00FF 100%)`). The screenshot wordmark is `--spectrum-wordmark-source` (`linear-gradient(90deg, #0060FF 0%, #824FF8 50%, #F5469B 100%)`). Those exact colors are decorative. White text on `#CC00FF` is about 4.19:1, and `#F5469B` on white is about 3.37:1, so text-bearing controls use adjusted stops in the same hues: `--spectrum-action-gradient` ends at `#C100F2` (about 4.62:1 with white) and `--spectrum-wordmark` ends at `#E40C75` (about 4.56:1 on the white sidebar). Hover uses `--spectrum-action-gradient-hover` and `--spectrum-glow`. Pressed buttons use solid `#3730A3`. Smaller controls, including the active product-rail item, stay on the solid primary. Muted and disabled text use `#676E87` because `#68718C` is about 4.38:1 on the muted surface and `#727991` is about 4.32:1 on white. These variables are set only for `electric-spectrum`. `prefers-reduced-motion` disables the extra color transitions.

## Preference

The saved value is one preset id, `system`, or a custom theme id (`ct_` plus 12 hex characters). It is stored in `localStorage` (`tradefix_appearance`) and on `users.theme`. The palette for a custom theme is not stored in that column.

- Missing or unknown values become `tradefix-purple`.
- Legacy `dark` becomes `midnight-pro`.
- Legacy `light` becomes `tradefix-purple`.
- An explicit saved id, including `classic`, stays that id.
- `system` stays Follow device.
- After sign-in, the account value wins. A failed save restores the last preference the server accepted. A newer selection ignores an older response.

`accent_color` remains on the profile API so older clients can still save it. The presets own the colors; the appearance screen no longer offers a separate accent picker.

New accounts are created with `theme="tradefix-purple"`. `users.theme` is `String(32)`. Migration `0031` widens the column and changes the server default for new inserts. It does not rewrite existing rows.

## Adding a preset

1. Add the id to `THEME_PRESET_IDS` and to a group in `THEME_GROUPS`. Keep it within 32 characters.
2. Add a full `ThemeTokens` object. Do not copy another preset at runtime.
3. Allow the id in `backend/app/schemas/auth.py` `_THEMES` and in `backend/app/schemas/custom_theme.py` `_BASE_THEMES`.
4. Run `npm run test:themes` from `frontend` and fix any contrast failure instead of lowering the threshold.

Saved custom themes store `base_theme_id`. Missing tokens are filled from that preset by `normalizeTokens`, so adding a catalog token does not invalidate older saves. Do not rename or remove a preset id that saved themes already use as a base.

## Custom Theme Studio

Custom Theme Studio is the last entry in the existing theme selector. Saved themes appear above it in **My custom themes**. The editor is `CustomThemeStudio`, hosted by `AppearanceProvider` through `ThemeStudioRoot`, so it stays open when the header menu closes.

There is one appearance path. A custom theme clones `cssVariablesFor(baseThemeId)` and overlays only the tokens that differ from that preset. `data-theme` stays the base preset id, so Violet Aurora and Electric Spectrum gradient CSS still applies. `data-preference` is the custom id. `data-custom-theme="1"` scopes extra rules so built-in presets are not restyled. Original TradeFix Purple keeps its sidebar treatment unless a custom theme or live preview is active (`semanticChrome`).

### Token contract

Editable colors are `CUSTOM_THEME_TOKENS` in `frontend/lib/custom-theme-tokens.ts`. Each token has an id, group, description, seed variable, and the CSS variables it writes.

Groups: brand, surfaces, text, borders, navigation, buttons, forms, status, financial, charts, components.

A token is seeded from the CSS variable the UI already uses (`color`, HSL `channel`, `focus` ring, or a gradient stop). Unchanged tokens are not written back. That keeps Original TradeFix Purple aliases intact, including `--muted` versus muted text and `--positive` versus success text. New variables that are absent from the base preset are written even when they match the seed, so a custom theme can bind those controls without a second provider.

Financial colors are separate from brand colors. Changing primary does not change `--color-chart-profit`, `--color-chart-loss`, or `--color-success-text`. Positive and negative P&L write `--color-pnl-positive` and `--color-pnl-negative`. Built-in presets do not set those variables, so their profit and loss colors stay on success and danger text.

Gradient edits replace hex stops inside the existing gradient strings. Angle and stop positions stay. Named spectrum colors update only when they equal the original stop.

### Derived values

These follow another token or stay with the base theme. They are not separate pickers.

- `--accent-hex` follows primary.
- HSL channel variables (`--primary`, `--background`, `--foreground`, `--surface`, `--card`, `--surface-2`, `--border`, sidebar channels, `--primary-foreground`) update when their matching token changes.
- `--positive` and `--negative` update only when Positive P&L or Negative P&L changes.
- `--positive-soft` and `--negative-soft` update only when the profit or loss badge background changes.
- Box shadows stay with the base theme. The modal overlay color is editable.
- Link colors apply to `a.text-primary`.
- The alternating-row token is used in the studio preview. Data tables use header, hover, and checkbox-selected row colors.
- Checkbox, radio, and range controls use the control accent. Switch track and thumb tokens are available for controls that read those variables.

### Storage and isolation

`users.theme` stores only the active id. Palettes live in `users.custom_themes`, a JSONB document `{ revision, themes }` added by migration `0032`. Apply it with `alembic upgrade head` from `backend` before signed-in saves will succeed.

The client sends the revision it last read. A mismatch returns HTTP 409 and the editor keeps the draft. The server increments the revision. The same profile update can set `theme` and `custom_themes`. Token keys must match `^[a-z][A-Za-z0-9]{0,48}$`. Values must be hex or `rgb()` / `rgba()`. Ids must be `ct_` plus 12 hex characters. Names are 1–48 characters and unique per user, ignoring case. At most 12 themes. A custom id cannot be a built-in preset. One user cannot read or change another user's document because it is a column on that user and the profile route is authenticated.

`localStorage` key `tradefix_appearance` also stores `customThemes`, `customRevision`, and `customCss` so the boot script can paint before JavaScript. That cache is not cross-device sync. While signed out, themes stay in that cache with revision 0. After sign-in, the account document replaces the local copy.

Editing uses a local draft. Nothing is written until Save. Cancel, and closing the editor, drop the draft and clear live preview.

### Editing behavior

The draft starts from the active theme, or from the saved theme being edited. Choosing a base copies that preset or saved theme into a new draft and does not modify the source. Undo and redo keep up to 50 color states. Reset one token or one group restores the current base. Reset all asks for confirmation. Invalid or partial color text is not applied.

Preview on application writes the draft onto the document without saving and without remounting the app. It is off by default so the editor stays readable. Cancel restores the last saved appearance. Save can also make the theme active.

Contrast checks use WCAG 2.2 ratios from `contrastRatio`: 4.5:1 for the text pairs in `CONTRAST_PAIRS`, 3:1 for the focus ring. A translucent background is measured on its parent surface when the pair names one, otherwise on white. Fix contrast suggests a foreground and applies it only after a click. A theme can still be saved when some pairs fail. The footer states how many fail. Built-in presets can already fail some pairs, including the default theme's muted text, success and danger washes, and the translucent focus ring. Those warnings describe the seeded colors. They do not change the preset until the user accepts a fix.

### Import and export

Export downloads JSON `{ kind: "tradefix-custom-theme", schemaVersion: 1, name, baseThemeId, mode, tokens }`. It does not include account data or credentials. Import checks the kind, schema version, name, and color values. Unknown token ids are ignored. Missing tokens are filled from the file's base theme, or from the selected base if that id is not a preset. Invalid colors are rejected. Import loads a draft. It does not replace a built-in theme until the user saves.

### Adding a token

1. Add one entry to `CUSTOM_THEME_TOKENS` with the seed variable the UI already uses and the variables it should write.
2. Point the component or a `[data-custom-theme="1"]` rule at that variable, with a fallback that matches the current preset.
3. Add a contrast pair if the token is text on a surface.
4. Run `npm run test:themes`.

The server does not keep a frozen list of token ids, so a new catalog token can be saved without a backend change. Keep the key and color rules above.

### Limits

- Some screens still use literal hex or `bg-white` for built-in themes. Custom themes restyle shared buttons, inputs, cards, dialogs, menus, overlays, tables, chart tooltips, and the sidebar through tokens and `[data-custom-theme="1"]`. A one-off hardcoded color outside those hooks will not follow the studio until that component reads a token.
- Disabled controls also stay faded. Their custom fill is an additional color, not a replacement for the disabled state.
- Guest themes do not merge into the account on login.
- Live preview is document-level CSS. It does not refetch trades or reset navigation, accounts, filters, or chart data. Charts that read `accentHex` repaint when primary changes.
