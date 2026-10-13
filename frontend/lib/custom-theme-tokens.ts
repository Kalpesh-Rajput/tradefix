/** Editable colors for Custom Theme Studio. Each id writes real CSS variables. */

export const TOKEN_GROUPS = [
  { id: "brand", label: "Brand and actions" },
  { id: "surfaces", label: "Backgrounds and surfaces" },
  { id: "text", label: "Text" },
  { id: "borders", label: "Borders and states" },
  { id: "navigation", label: "Sidebar, header, and navigation" },
  { id: "buttons", label: "Buttons and controls" },
  { id: "forms", label: "Forms and validation" },
  { id: "status", label: "Status" },
  { id: "financial", label: "Trading and financial" },
  { id: "charts", label: "Charts" },
  { id: "components", label: "Tables, badges, and chrome" },
] as const;

export type TokenGroupId = (typeof TOKEN_GROUPS)[number]["id"];

export type TokenSeed =
  | { from: "color" | "channel" | "focus"; css: string }
  | { from: "gradient"; index: 0 | 1 | 2 };

export type ThemeTokenDef = {
  id: string;
  label: string;
  description: string;
  group: TokenGroupId;
  seed: TokenSeed;
  colorVars?: string[];
  channels?: string[];
  focusRing?: boolean;
  alpha?: boolean;
};

function token(
  id: string,
  label: string,
  description: string,
  group: TokenGroupId,
  seed: TokenSeed,
  writes: Pick<ThemeTokenDef, "colorVars" | "channels" | "focusRing" | "alpha"> = {}
): ThemeTokenDef {
  return { id, label, description, group, seed, ...writes };
}

export const CUSTOM_THEME_TOKENS: ThemeTokenDef[] = [
  token("primary", "Primary", "Primary buttons, links that follow the brand, and the accent swatch.", "brand", { from: "color", css: "--color-primary" }, { colorVars: ["--color-primary", "--accent-hex"], channels: ["--primary"] }),
  token("primaryHover", "Primary hover", "Hover background for primary buttons.", "brand", { from: "color", css: "--color-primary-hover" }, { colorVars: ["--color-primary-hover"] }),
  token("primaryActive", "Primary pressed", "Pressed background for primary buttons.", "brand", { from: "color", css: "--color-primary-active" }, { colorVars: ["--color-primary-active"] }),
  token("primaryForeground", "Primary foreground", "Text and icons on primary buttons.", "brand", { from: "color", css: "--color-primary-foreground" }, { colorVars: ["--color-primary-foreground"], channels: ["--primary-foreground"] }),
  token("primarySubtle", "Primary subtle background", "Soft brand tint behind selected chips and highlights.", "brand", { from: "color", css: "--color-primary-light" }, { colorVars: ["--color-primary-light"] }),
  token("primaryVeryLight", "Primary quieter background", "The lightest brand wash, including secondary button hover on the default theme.", "brand", { from: "color", css: "--color-primary-very-light" }, { colorVars: ["--color-primary-very-light"] }),
  token("secondaryAccent", "Secondary accent", "The accent utility. It starts equal to primary and can diverge.", "brand", { from: "channel", css: "--accent" }, { channels: ["--accent"] }),
  token("focusRing", "Focus ring", "Keyboard focus ring and the ring utility.", "brand", { from: "focus", css: "--focus-ring" }, { channels: ["--ring"], focusRing: true }),
  token("selection", "Selection highlight", "Text selection background.", "brand", { from: "channel", css: "--primary" }, { colorVars: ["--color-selection"], alpha: true }),
  token("link", "Link", "Anchor text that uses the primary text color.", "brand", { from: "color", css: "--color-primary" }, { colorVars: ["--color-link"] }),
  token("linkHover", "Link hover", "Hover color for those links.", "brand", { from: "color", css: "--color-primary-hover" }, { colorVars: ["--color-link-hover"] }),
  token("gradientStart", "Gradient start", "First stop of brand gradients. Direction and positions stay as designed.", "brand", { from: "gradient", index: 0 }),
  token("gradientMiddle", "Gradient middle", "Middle stop of brand gradients.", "brand", { from: "gradient", index: 1 }),
  token("gradientEnd", "Gradient end", "Last stop of brand gradients.", "brand", { from: "gradient", index: 2 }),

  token("background", "Page background", "The main application background.", "surfaces", { from: "color", css: "--color-background" }, { colorVars: ["--color-background"], channels: ["--background"] }),
  token("backgroundSubtle", "Subtle page background", "Secondary page wash behind nested regions.", "surfaces", { from: "color", css: "--color-background-subtle" }, { colorVars: ["--color-background-subtle"] }),
  token("surface", "Card surface", "Cards, panels, and the default dialog fill.", "surfaces", { from: "color", css: "--color-surface" }, { colorVars: ["--color-surface"], channels: ["--surface"] }),
  token("surfaceElevated", "Elevated surface", "Raised cards that use the card token.", "surfaces", { from: "color", css: "--color-surface-elevated" }, { colorVars: ["--color-surface-elevated"], channels: ["--card"] }),
  token("surfaceMuted", "Muted surface", "Muted panels and the surface-2 utility.", "surfaces", { from: "color", css: "--color-surface-muted" }, { colorVars: ["--color-surface-muted"], channels: ["--surface-2"] }),
  token("surfaceSecondary", "Secondary surface", "The secondary surface variable. On the default theme this is separate from the muted surface.", "surfaces", { from: "color", css: "--color-surface-secondary" }, { colorVars: ["--color-surface-secondary"] }),
  token("surfaceSelected", "Selected surface", "Selected rows, chips, and navigation washes that use this token.", "surfaces", { from: "color", css: "--color-surface-selected" }, { colorVars: ["--color-surface-selected"] }),
  token("nested", "Nested panel", "Cards placed inside another card.", "surfaces", { from: "color", css: "--color-surface" }, { colorVars: ["--color-nested"] }),
  token("dialog", "Dialog background", "Modal and drawer panels.", "surfaces", { from: "color", css: "--color-surface" }, { colorVars: ["--color-dialog"] }),
  token("popover", "Popover background", "Small popovers. Elevated cards stay on the elevated surface token.", "surfaces", { from: "color", css: "--color-surface-elevated" }, { colorVars: ["--color-popover"] }),
  token("dropdown", "Dropdown background", "Menus, listboxes, and trade dropdowns.", "surfaces", { from: "color", css: "--color-surface" }, { colorVars: ["--color-dropdown"] }),
  token("overlay", "Modal overlay", "The scrim behind dialogs and drawers.", "surfaces", { from: "color", css: "--color-overlay" }, { colorVars: ["--color-overlay"], alpha: true }),

  token("textPrimary", "Primary text", "Headings and body copy.", "text", { from: "color", css: "--color-text-primary" }, { colorVars: ["--color-text-primary"], channels: ["--foreground"] }),
  token("textKpi", "KPI text", "Large metric figures.", "text", { from: "color", css: "--color-text-kpi" }, { colorVars: ["--color-text-kpi"] }),
  token("textSecondary", "Secondary text", "Supporting copy and table secondary labels.", "text", { from: "color", css: "--color-text-secondary" }, { colorVars: ["--color-text-secondary"] }),
  token("textLabel", "Label text", "Form and metric labels.", "text", { from: "color", css: "--color-text-label" }, { colorVars: ["--color-text-label"] }),
  token("textTertiary", "Tertiary text", "De-emphasized copy that is separate from muted text on the default theme.", "text", { from: "color", css: "--color-text-tertiary" }, { colorVars: ["--color-text-tertiary"] }),
  token("textMuted", "Muted text", "Hints and metadata that use the muted color variable.", "text", { from: "color", css: "--color-text-muted" }, { colorVars: ["--color-text-muted"] }),
  token("textMutedUtility", "Muted utility text", "Text using the muted utility, including many placeholders.", "text", { from: "channel", css: "--muted" }, { channels: ["--muted"] }),
  token("textInverse", "Inverse text", "Text on inverse surfaces.", "text", { from: "color", css: "--color-text-inverse" }, { colorVars: ["--color-text-inverse"] }),
  token("textDisabled", "Disabled text", "Disabled labels and controls.", "text", { from: "color", css: "--color-text-disabled" }, { colorVars: ["--color-text-disabled"] }),
  token("placeholder", "Placeholder", "Placeholder copy inside fields.", "text", { from: "color", css: "--color-placeholder" }, { colorVars: ["--color-placeholder"] }),
  token("inputText", "Input text", "Typed text inside fields.", "text", { from: "color", css: "--color-text-primary" }, { colorVars: ["--color-input-text"] }),
  token("tooltipTitle", "Tooltip text", "Tooltip and chart-tooltip copy.", "text", { from: "color", css: "--color-tooltip-text" }, { colorVars: ["--color-tooltip-text"] }),

  token("border", "Standard border", "Default borders on cards, fields, and dividers that share this token.", "borders", { from: "color", css: "--color-border" }, { colorVars: ["--color-border"], channels: ["--border"] }),
  token("borderStrong", "Strong border", "Emphasized borders.", "borders", { from: "color", css: "--color-border-strong" }, { colorVars: ["--color-border-strong"] }),
  token("borderSubtle", "Subtle border", "Quiet borders.", "borders", { from: "color", css: "--color-border-subtle" }, { colorVars: ["--color-border-subtle"] }),
  token("borderLight", "Light border", "The lighter border used by the default theme.", "borders", { from: "color", css: "--color-border-light" }, { colorVars: ["--color-border-light"] }),
  token("divider", "Divider", "Section dividers.", "borders", { from: "color", css: "--color-divider" }, { colorVars: ["--color-divider"] }),
  token("inputBorder", "Input border", "Resting field borders.", "borders", { from: "color", css: "--color-input-border" }, { colorVars: ["--color-input-border"] }),
  token("inputHoverBorder", "Input hover border", "Field border on hover.", "borders", { from: "color", css: "--color-input-border" }, { colorVars: ["--color-input-hover-border"] }),
  token("inputFocusBorder", "Input focus border", "Field border while focused.", "borders", { from: "color", css: "--color-primary" }, { colorVars: ["--color-input-focus-border"] }),
  token("selectedBorder", "Selected border", "Outline of a selected card or option.", "borders", { from: "color", css: "--color-primary" }, { colorVars: ["--color-selected-border"] }),
  token("disabledBorder", "Disabled border", "Borders of disabled fields.", "borders", { from: "color", css: "--color-border" }, { colorVars: ["--color-disabled-border"] }),
  token("cardBorder", "Card border", "Dashboard card outlines.", "borders", { from: "color", css: "--color-border" }, { colorVars: ["--color-card-border"] }),
  token("tableDivider", "Table divider", "Lines between table rows.", "borders", { from: "color", css: "--color-border" }, { colorVars: ["--color-table-border"] }),
  token("tooltipBorder", "Tooltip border", "Chart and hint tooltip outlines.", "borders", { from: "color", css: "--color-tooltip-border" }, { colorVars: ["--color-tooltip-border"] }),

  token("sidebar", "Sidebar background", "Navigation column background.", "navigation", { from: "color", css: "--color-sidebar" }, { colorVars: ["--color-sidebar"], channels: ["--sidebar"] }),
  token("sidebarForeground", "Sidebar text", "Primary navigation labels.", "navigation", { from: "color", css: "--color-sidebar-text" }, { colorVars: ["--color-sidebar-text"], channels: ["--sidebar-foreground"] }),
  token("sidebarSecondary", "Sidebar secondary text", "Secondary navigation copy.", "navigation", { from: "color", css: "--color-sidebar-secondary" }, { colorVars: ["--color-sidebar-secondary"] }),
  token("sidebarMuted", "Sidebar muted text", "Inactive navigation labels.", "navigation", { from: "channel", css: "--sidebar-muted" }, { channels: ["--sidebar-muted"] }),
  token("sidebarIcon", "Navigation icon", "Sidebar icons.", "navigation", { from: "color", css: "--color-sidebar-icon" }, { colorVars: ["--color-sidebar-icon"] }),
  token("sidebarHover", "Sidebar hover", "Navigation row hover.", "navigation", { from: "color", css: "--color-sidebar-hover" }, { colorVars: ["--color-sidebar-hover"], alpha: true }),
  token("sidebarActive", "Sidebar selected background", "The active navigation row.", "navigation", { from: "color", css: "--color-sidebar-active" }, { colorVars: ["--color-sidebar-active"], alpha: true }),
  token("sidebarActiveText", "Sidebar selected text", "Label on the active navigation row.", "navigation", { from: "channel", css: "--sidebar-foreground" }, { colorVars: ["--color-sidebar-active-text"] }),
  token("sidebarBorder", "Sidebar border", "The edge between the sidebar and the page.", "navigation", { from: "channel", css: "--sidebar-border" }, { channels: ["--sidebar-border"] }),
  token("sidebarDivider", "Sidebar divider", "Dividers inside the sidebar.", "navigation", { from: "color", css: "--color-sidebar-divider" }, { colorVars: ["--color-sidebar-divider"] }),
  token("sidebarIndicator", "Sidebar indicator", "The active-row accent bar.", "navigation", { from: "color", css: "--color-sidebar-indicator" }, { colorVars: ["--color-sidebar-indicator"] }),
  token("header", "Header background", "The top application bar.", "navigation", { from: "color", css: "--color-header" }, { colorVars: ["--color-header"] }),
  token("headerForeground", "Header text", "Title text in the top bar.", "navigation", { from: "color", css: "--color-text-primary" }, { colorVars: ["--color-header-foreground"] }),
  token("headerBorder", "Header border", "The line under the top bar.", "navigation", { from: "color", css: "--color-border" }, { colorVars: ["--color-header-border"] }),

  token("buttonSecondaryBg", "Secondary button background", "Secondary button fill.", "buttons", { from: "channel", css: "--surface-2" }, { colorVars: ["--color-button-secondary-bg"] }),
  token("buttonSecondaryFg", "Secondary button text", "Secondary button label.", "buttons", { from: "channel", css: "--foreground" }, { colorVars: ["--color-button-secondary-fg"] }),
  token("buttonSecondaryBorder", "Outline button border", "Secondary and outline button borders.", "buttons", { from: "channel", css: "--border" }, { colorVars: ["--color-button-secondary-border"] }),
  token("buttonSecondaryHover", "Secondary button hover", "Secondary button hover fill.", "buttons", { from: "channel", css: "--surface" }, { colorVars: ["--color-button-secondary-hover"] }),
  token("buttonGhostFg", "Ghost button text", "Quiet button labels.", "buttons", { from: "channel", css: "--muted" }, { colorVars: ["--color-button-ghost-fg"] }),
  token("buttonGhostHover", "Ghost button hover", "Quiet button hover fill.", "buttons", { from: "color", css: "--color-surface-muted" }, { colorVars: ["--color-button-ghost-hover"] }),
  token("buttonDangerBg", "Destructive button background", "Danger button fill.", "buttons", { from: "color", css: "--color-danger-bg" }, { colorVars: ["--color-button-danger-bg"] }),
  token("buttonDangerFg", "Destructive button text", "Danger button label.", "buttons", { from: "color", css: "--color-danger-text" }, { colorVars: ["--color-button-danger-fg"] }),
  token("buttonDisabledBg", "Disabled button background", "Disabled button fill. Disabled buttons also stay faded.", "buttons", { from: "color", css: "--color-surface-muted" }, { colorVars: ["--color-button-disabled-bg"] }),
  token("buttonDisabledFg", "Disabled button text", "Disabled button label.", "buttons", { from: "color", css: "--color-text-disabled" }, { colorVars: ["--color-button-disabled-fg"] }),
  token("controlAccent", "Checkbox, radio, and slider", "Selected checkbox, radio, and range controls.", "buttons", { from: "color", css: "--color-primary" }, { colorVars: ["--color-control-accent"] }),
  token("switchTrack", "Switch track", "Toggle track in the studio preview and switch controls.", "buttons", { from: "color", css: "--color-border" }, { colorVars: ["--color-switch-track"] }),
  token("switchThumb", "Switch thumb", "Toggle thumb.", "buttons", { from: "color", css: "--color-surface" }, { colorVars: ["--color-switch-thumb"] }),

  token("inputBg", "Input background", "Field fill.", "forms", { from: "color", css: "--color-input-bg" }, { colorVars: ["--color-input-bg"] }),
  token("inputDisabledBg", "Disabled input background", "Fill for disabled fields.", "forms", { from: "color", css: "--color-surface-muted" }, { colorVars: ["--color-input-disabled-bg"] }),
  token("inputError", "Validation error", "Error borders and messages.", "forms", { from: "color", css: "--color-danger-text" }, { colorVars: ["--color-input-error"] }),
  token("inputSuccess", "Validation success", "Success borders on fields.", "forms", { from: "color", css: "--color-success-text" }, { colorVars: ["--color-input-success"] }),
  token("optionSelected", "Selected option", "The highlighted option in a menu.", "forms", { from: "color", css: "--color-surface-selected" }, { colorVars: ["--color-option-selected"] }),
  token("optionHover", "Option hover", "Menu option hover.", "forms", { from: "color", css: "--color-table-hover" }, { colorVars: ["--color-option-hover"] }),
  token("helperText", "Helper text", "Field hints under inputs.", "forms", { from: "color", css: "--color-text-muted" }, { colorVars: ["--color-helper-text"] }),

  token("success", "Success icon", "Success icons and the success color token.", "status", { from: "color", css: "--color-success" }, { colorVars: ["--color-success"] }),
  token("successText", "Success text", "Success labels. Profit figures use Positive P&L instead, so a brand accent does not replace green.", "status", { from: "color", css: "--color-success-text" }, { colorVars: ["--color-success-text"] }),
  token("successSubtle", "Success background", "Success badge and banner fill.", "status", { from: "color", css: "--color-success-bg" }, { colorVars: ["--color-success-bg"] }),
  token("successLight", "Success light background", "The lighter success wash on the default theme.", "status", { from: "color", css: "--color-success-light" }, { colorVars: ["--color-success-light"] }),
  token("successBorder", "Success border", "Success outlines.", "status", { from: "color", css: "--color-success-text" }, { colorVars: ["--color-success-border"] }),
  token("successDark", "Success strong", "Darker success text used by some presets.", "status", { from: "color", css: "--color-success-dark" }, { colorVars: ["--color-success-dark"] }),
  token("danger", "Danger icon", "Danger icons and the danger color token.", "status", { from: "color", css: "--color-danger" }, { colorVars: ["--color-danger"] }),
  token("dangerText", "Danger text", "Error labels. Loss figures use Negative P&L.", "status", { from: "color", css: "--color-danger-text" }, { colorVars: ["--color-danger-text"] }),
  token("dangerSubtle", "Danger background", "Error badge and banner fill.", "status", { from: "color", css: "--color-danger-bg" }, { colorVars: ["--color-danger-bg"] }),
  token("dangerLight", "Danger light background", "The lighter danger wash.", "status", { from: "color", css: "--color-danger-light" }, { colorVars: ["--color-danger-light"] }),
  token("dangerBorder", "Danger border", "Error outlines.", "status", { from: "color", css: "--color-danger-text" }, { colorVars: ["--color-danger-border"] }),
  token("dangerDark", "Danger strong", "Darker danger text used by some presets.", "status", { from: "color", css: "--color-danger-dark" }, { colorVars: ["--color-danger-dark"] }),
  token("warning", "Warning icon", "Warning icons.", "status", { from: "color", css: "--color-warning" }, { colorVars: ["--color-warning"] }),
  token("warningText", "Warning text", "Warning labels.", "status", { from: "color", css: "--color-warning-text" }, { colorVars: ["--color-warning-text"] }),
  token("warningSubtle", "Warning background", "Warning banner fill.", "status", { from: "color", css: "--color-warning-bg" }, { colorVars: ["--color-warning-bg"] }),
  token("warningBadge", "Warning badge", "Warning badge fill.", "status", { from: "color", css: "--color-warning-badge" }, { colorVars: ["--color-warning-badge"] }),
  token("warningBadgeText", "Warning badge text", "Text on warning badges.", "status", { from: "color", css: "--color-warning-badge-text" }, { colorVars: ["--color-warning-badge-text"] }),
  token("warningBorder", "Warning border", "Warning outlines.", "status", { from: "color", css: "--color-warning" }, { colorVars: ["--color-warning-border"] }),
  token("info", "Information icon", "Information icons.", "status", { from: "color", css: "--color-info" }, { colorVars: ["--color-info"] }),
  token("infoText", "Information text", "Information labels.", "status", { from: "color", css: "--color-info-text" }, { colorVars: ["--color-info-text"] }),
  token("infoSubtle", "Information background", "Information banner fill.", "status", { from: "color", css: "--color-info-bg" }, { colorVars: ["--color-info-bg"] }),
  token("infoBorder", "Information border", "Information outlines.", "status", { from: "color", css: "--color-info" }, { colorVars: ["--color-info-border"] }),

  token("pnlPositive", "Positive P&L", "Profit text. Independent from the brand accent.", "financial", { from: "color", css: "--color-success-text" }, { colorVars: ["--color-pnl-positive"], channels: ["--positive"] }),
  token("pnlNegative", "Negative P&L", "Loss text. Independent from the brand accent.", "financial", { from: "color", css: "--color-danger-text" }, { colorVars: ["--color-pnl-negative"], channels: ["--negative", "--destructive"] }),
  token("breakeven", "Break-even", "Flat or neutral P&L.", "financial", { from: "color", css: "--color-breakeven" }, { colorVars: ["--color-breakeven"] }),
  token("negativeHex", "Loss marker", "Compact loss marks that use the negative hex token.", "financial", { from: "color", css: "--color-negative-hex" }, { colorVars: ["--color-negative-hex"] }),
  token("profitBadgeBg", "Profit badge background", "Background of profit chips.", "financial", { from: "color", css: "--color-success-bg" }, { colorVars: ["--color-profit-badge-bg"], channels: ["--positive-soft"] }),
  token("profitBadgeFg", "Profit badge text", "Text of profit chips.", "financial", { from: "color", css: "--color-success-text" }, { colorVars: ["--color-profit-badge-fg"] }),
  token("lossBadgeBg", "Loss badge background", "Background of loss chips.", "financial", { from: "color", css: "--color-danger-bg" }, { colorVars: ["--color-loss-badge-bg"], channels: ["--negative-soft"] }),
  token("lossBadgeFg", "Loss badge text", "Text of loss chips.", "financial", { from: "color", css: "--color-danger-text" }, { colorVars: ["--color-loss-badge-fg"] }),
  token("winRate", "Win rate", "Win-rate bars.", "financial", { from: "color", css: "--color-chart-profit" }, { colorVars: ["--color-win-rate"] }),
  token("winningMarker", "Winning trade marker", "Marks for winning trades in the preview and win-rate series.", "financial", { from: "color", css: "--color-chart-profit" }, { colorVars: ["--color-win-marker"] }),
  token("losingMarker", "Losing trade marker", "Marks for losing trades.", "financial", { from: "color", css: "--color-chart-loss" }, { colorVars: ["--color-loss-marker"] }),

  token("chartBackground", "Chart background", "Plotting area behind chart series.", "charts", { from: "color", css: "--color-surface" }, { colorVars: ["--color-chart-bg"] }),
  token("chartGrid", "Gridlines", "Chart gridlines.", "charts", { from: "color", css: "--color-chart-grid" }, { colorVars: ["--color-chart-grid"] }),
  token("chartAxis", "Axis labels and lines", "Axis labels, ticks, and axis lines.", "charts", { from: "color", css: "--color-chart-axis" }, { colorVars: ["--color-chart-axis"] }),
  token("chartLegend", "Legend text", "Chart legend labels.", "charts", { from: "color", css: "--color-text-secondary" }, { colorVars: ["--color-chart-legend"] }),
  token("chartCrosshair", "Crosshair", "Hover crosshair on charts.", "charts", { from: "color", css: "--color-chart-axis" }, { colorVars: ["--color-chart-crosshair"] }),
  token("chartLine", "Equity and primary series", "Equity curve and the primary chart line.", "charts", { from: "color", css: "--color-chart-line" }, { colorVars: ["--color-chart-line"] }),
  token("chartDrawdown", "Drawdown", "Drawdown curve and drawdown warnings.", "charts", { from: "color", css: "--color-chart-drawdown" }, { colorVars: ["--color-chart-drawdown"] }),
  token("chartProfit", "Positive bars", "Profit bars and positive chart fills that use the profit series.", "charts", { from: "color", css: "--color-chart-profit" }, { colorVars: ["--color-chart-profit"] }),
  token("chartProfitSoft", "Positive area", "Soft positive area fill.", "charts", { from: "color", css: "--color-chart-profit-soft" }, { colorVars: ["--color-chart-profit-soft"] }),
  token("chartLoss", "Negative bars", "Loss bars.", "charts", { from: "color", css: "--color-chart-loss" }, { colorVars: ["--color-chart-loss"] }),
  token("chartLossSoft", "Negative area", "Soft negative area fill.", "charts", { from: "color", css: "--color-chart-loss-soft" }, { colorVars: ["--color-chart-loss-soft"] }),
  token("chartSeries", "Comparison series", "Secondary and comparison series.", "charts", { from: "color", css: "--color-chart-series" }, { colorVars: ["--color-chart-series"] }),
  token("chartTertiary", "Additional series", "A third series where a chart defines one.", "charts", { from: "color", css: "--color-chart-series" }, { colorVars: ["--color-chart-tertiary"] }),
  token("chartTooltipBg", "Chart tooltip background", "Tooltip surface on charts.", "charts", { from: "color", css: "--color-tooltip-bg" }, { colorVars: ["--color-tooltip-bg"] }),

  token("tableHeader", "Table header background", "Header row fill.", "components", { from: "color", css: "--color-table-header" }, { colorVars: ["--color-table-header"] }),
  token("tableHeaderFg", "Table header text", "Header row labels.", "components", { from: "color", css: "--color-text-secondary" }, { colorVars: ["--color-table-header-foreground"] }),
  token("tableHover", "Table row hover", "Hovered data row.", "components", { from: "color", css: "--color-table-hover" }, { colorVars: ["--color-table-hover"] }),
  token("tableSelected", "Table selected row", "A row with a selected checkbox.", "components", { from: "color", css: "--color-table-selected" }, { colorVars: ["--color-table-selected"] }),
  token("tableStripe", "Alternating row", "Stripe on even rows in the preview. Data tables use hover and selected colors.", "components", { from: "color", css: "--color-surface" }, { colorVars: ["--color-table-stripe"] }),
  token("skeleton", "Skeleton", "Loading placeholders.", "components", { from: "color", css: "--color-skeleton" }, { colorVars: ["--color-skeleton", "--color-gauge-track"] }),
  token("scrollbar", "Scrollbar thumb", "Scrollbar thumb.", "components", { from: "color", css: "--color-scrollbar" }, { colorVars: ["--color-scrollbar"] }),
  token("scrollbarTrack", "Scrollbar track", "Scrollbar track.", "components", { from: "color", css: "--color-background" }, { colorVars: ["--color-scrollbar-track"] }),
  token("toastBg", "Toast surface", "Notification toast background.", "components", { from: "color", css: "--color-surface" }, { colorVars: ["--color-toast-bg"] }),
  token("toastFg", "Toast text", "Notification toast text.", "components", { from: "color", css: "--color-text-primary" }, { colorVars: ["--color-toast-fg"] }),
];

export const CUSTOM_THEME_TOKEN_IDS = CUSTOM_THEME_TOKENS.map((token) => token.id);

const TOKEN_INDEX = new Map(CUSTOM_THEME_TOKENS.map((token) => [token.id, token]));

export function tokenById(id: string): ThemeTokenDef | undefined {
  return TOKEN_INDEX.get(id);
}

export function tokensInGroup(group: TokenGroupId): ThemeTokenDef[] {
  return CUSTOM_THEME_TOKENS.filter((token) => token.group === group);
}
