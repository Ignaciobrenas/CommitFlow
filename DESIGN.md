# CommitFlow Design System (DESIGN.md)

## 1. Visual Theme & Atmosphere
- **Philosophy:** **"Precision Developer Telemetry"**. High information density without visual noise; native VS Code integration that respects 100% of the user's active IDE theme (Light, Dark, High Contrast Dark, High Contrast Light) while delivering vivid semantic identity across the commit DAG via curated chromatic lane palettes.
- **Surface Hierarchy:** Strictly layered via native VS Code tokens with sensible fallbacks:
  - Primary Canvas / Editor Surface: `var(--vscode-editor-background)` (`--bg-primary`)
  - Secondary Chrome / Sidebar / Header: `var(--vscode-sideBar-background)` (`--bg-secondary`)
  - Elevated / Tabs / Popovers / Modals: `var(--vscode-editorGroupHeader-tabsBackground)` / `var(--vscode-panel-background)` (`--bg-tertiary`)
  - Interactive States: `var(--vscode-list-hoverBackground)` (`--bg-hover`), `var(--vscode-list-activeSelectionBackground)` (`--bg-active`)
  - Borders & Focus: `var(--vscode-widget-border)` / `var(--vscode-panel-border)` (`--border-subtle`), `var(--vscode-focusBorder)` (`--focus-ring`)

## 2. Color Palette & Tokens
- **Base IDE Integration:**
  - Foreground: `var(--vscode-editor-foreground)` / `var(--vscode-foreground)`
  - Secondary Muted Text: `var(--vscode-descriptionForeground)`
  - Focus Ring: `var(--vscode-focusBorder)` (must always remain visible on keyboard focus)
  - High Contrast Borders: `var(--vscode-contrastBorder)`, `var(--vscode-contrastActiveBorder)`
- **Semantic Status Tokens:**
  - `Success / Bisect Good / Valid Sig / Ready PR`: `#10b981` (`--accent-emerald` in Dark) / `#1a7f37` (Light)
  - `Danger / Bisect Bad / Conflict / Drop`: `#ef4444` / `#f43f5e` (`--accent-rose` in Dark) / `#cf222e` (Light)
  - `Warning / Untrusted / Dirty / Pending`: `#f59e0b` (`--accent-amber` in Dark) / `#9a6700` (Light)
  - `Probe / Active Bisect / Primary Accent`: `#38bdf8` / `#06b6d4` (`--accent-cyan` in Dark) / `#0969da` (Light)
  - `MCP / AI Studio / Rebase Accent`: `#8b5cf6` (`--accent-violet` in Dark) / `#8250df` (Light)
- **DAG Chromatic Lane Palettes (`GraphLayout.THEME_LANE_COLORS`):**
  - Supported presets: `auto`, `dark`, `light`, `cyberpunk`, `dracula`, `github`, `neon-pink`, `neon-green`, `neon-blue`.
  - Adjacent lanes must maintain clear perceptual color separation. In High Contrast themes (`vscode-high-contrast`, `vscode-high-contrast-light`), borders and focus outlines override subtle alpha fills.

## 3. Typography & Rhythm
- **UI Font:** `var(--vscode-font-family)` with adaptive sizing (`--font-size-base: 12px`, `--font-size-sm: 11px`, `--font-size-xs: 10px`).
- **Monospace Telemetry Font:** `var(--vscode-editor-font-family)` with mandatory `font-variant-numeric: tabular-nums` (`class="tabular-nums"`) for:
  - Commit SHAs (`shortHash`, full 40/64-char SHA)
  - Diff line deltas (`+N / -M`)
  - Relative/absolute timestamps, branch pill counters, and stat bar counters
  - File paths and bisect step estimators
- **Spacing & Radii:** `--radius-xs: 4px`, `--radius-sm: 6px`, `--radius-md: 8px`, `--radius-lg: 10px`, `--radius-xl: 12px`, `--radius-full: 9999px`.
- **Density Tiers (`commitflow.graph.density`):** `compact` (`22px` row height), `comfortable` (`26px`), `spacious` (`32px`).

## 4. Adaptive Multi-Dock Breakpoints
CommitFlow operates seamlessly across left/right Activity Bar sidebars, bottom terminal panel, and full Editor panels using container-aware layout classes:
- **Nano (`<= 260px` / `.layout-nano`):**
  - Navigation tabs collapse to icon-only buttons with native `title` + `aria-label` tooltips.
  - Secondary metadata (author email, timestamps, extra stats dividers) are hidden cleanly.
  - Minimum touch/click target size `28x28px`.
- **Sidebar Compact (`261px - 440px` / `.layout-sidebar-compact`):**
  - Single-column stacked layout for DAG rows and cards.
  - Inspector drawer renders as a full-width overlay drawer clamped cleanly inside the viewport.
- **Compact (`441px - 600px` / `.layout-width-compact`):**
  - Compact branch pills, abbreviated badges, wrapped flex toolbars with zero horizontal overflow.
- **Wide / Bottom Panel (`> 600px`):**
  - Dual-pane split view (DAG + Minimap on the left, Commit/PR Inspector Drawer on the right) or horizontal bottom-dock layout (`>= 540px` width and `<= 380px` height -> `.auto-detected-bottom` / `.layout-height-short`).

## 5. Component Rules (Zero Deprecated Toolkits)
1. **ZERO `@vscode/webview-ui-toolkit`:** Officially deprecated and archived in January 2025. Never import or depend on it.
2. **Native UI Primitives (`src/webview/primitives.ts`):** All new UI elements use CommitFlow's lightweight zero-dependency primitives (`CfButton`, `CfBadge`, `CfDrawer`, `CfTabs`, `CfToast`, `CfSkeleton`) built exclusively with `--vscode-*` CSS variables and `@vscode/codicons`.
3. **Icons:** Use `@vscode/codicons` (`<i class="codicon codicon-...">`) or accessible inline SVGs marked with `aria-hidden="true"`.
4. **Viewport Clamping & Popover Dismissal:** All popovers, tooltips, context menus, and drawers must clamp against viewport edges (`clampPopoverToViewport`) and dismiss on outside click or `Escape`.
5. **Motion & Reduced Motion:** Use `--ease-spring` / `--duration-fast` for crisp transitions, and strictly disable animations, spinners, and pulse keyframes inside `@media (prefers-reduced-motion: reduce)`.
6. **Security & CSP:** Enforce `default-src 'none'` with cryptographic `nonce` per load; never inject untrusted user or commit strings via raw `innerHTML` without HTML escaping.
7. **Accessibility (WCAG 2.1 AA):**
   - Graph container uses `role="treegrid"` with `role="row"` and `role="gridcell"`, descriptive `aria-label` per commit, and roving `tabindex` (`ArrowUp`, `ArrowDown`, `PageUp`, `PageDown`, `Home`, `End`).
   - All modals trap `Tab`/`Shift+Tab` focus (`trapModalFocus`) and restore focus on close.
