# TradeFix themes

TradeFix has one appearance system. Presets live in `frontend/lib/theme-registry.ts`. `frontend/lib/appearance.ts` applies them, and `AppearanceProvider` saves the choice.

## Presets

| Id | Name | Mode |
| --- | --- | --- |
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

`system` is not another palette. It is Follow device: Classic when the operating system prefers light, Midnight Pro when it prefers dark. It updates when the OS appearance changes. It does not select Obsidian Gold.

## Tokens

Each preset stores canonical `#RRGGBB` values for surfaces, text, borders, primary actions, inputs, sidebar, tables, tooltips, status colors, and charts.

Tailwind utilities such as `bg-background` and `text-primary` read `hsl(var(--token) / <alpha-value>)`. Those variables are HSL channels (`243 75% 59%`), derived from the hex by `hexToHslChannels`. Do not put a hex color in a channel variable.

`--color-*` variables hold the same hex for inline styles, Recharts, and existing `var(--color-text-primary)` call sites. Chart series use `--color-chart-profit`, `--color-chart-loss`, `--color-chart-line`, and `--color-chart-series`. Small profit and loss text uses `--color-success-text` and `--color-danger-text`, not the pale bar fills.

`applyAppearanceToDocument` and the boot script in the root layout both use `PRESET_CSS_VARIABLES` from the registry.

Violet Aurora keeps profit green and loss red. Its primary actions use `--aurora-gradient` (`linear-gradient(135deg, #5B21B6 0%, #7C3AED 55%, #9333EA 100%)`). Hover adds `--aurora-glow`. Those variables are set only for `violet-aurora`. Active navigation and pressed toggles use the lavender selected surface. Card shadows and the focus ring for that preset are in its chrome tokens. `prefers-reduced-motion` disables the extra color transitions.

Electric Spectrum keeps profit green and loss red. Its brand gradient is `--spectrum-gradient` (`linear-gradient(100deg, #0060FF 0%, #6830FF 50%, #CC00FF 100%)`). The screenshot wordmark is `--spectrum-wordmark-source` (`linear-gradient(90deg, #0060FF 0%, #824FF8 50%, #F5469B 100%)`). Those exact colors are decorative. White text on `#CC00FF` is about 4.19:1, and `#F5469B` on white is about 3.37:1, so text-bearing controls use adjusted stops in the same hues: `--spectrum-action-gradient` ends at `#C100F2` (about 4.62:1 with white) and `--spectrum-wordmark` ends at `#E40C75` (about 4.56:1 on the white sidebar). Hover uses `--spectrum-action-gradient-hover` and `--spectrum-glow`. Pressed buttons use solid `#3730A3`. Smaller controls, including the active product-rail item, stay on the solid primary. Muted and disabled text use `#676E87` because `#68718C` is about 4.38:1 on the muted surface and `#727991` is about 4.32:1 on white. These variables are set only for `electric-spectrum`. `prefers-reduced-motion` disables the extra color transitions.

## Preference

The saved value is one preset id or `system`. It is stored in `localStorage` (`tradefix_appearance`) and on `users.theme`.

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
3. Allow the id in `backend/app/schemas/auth.py` `_THEMES`.
4. Run `npm run test:themes` from `frontend` and fix any contrast failure instead of lowering the threshold.
