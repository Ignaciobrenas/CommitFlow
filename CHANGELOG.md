# Change Log

All notable changes to the "commitflow" extension will be documented in this file.

## [0.4.8] - 2026-11-04

### Added
- Enterprise-grade universal responsive design covering all modules, viewports (from 240px sidebars to 4K displays), dialogs, cards, and bottom dock layouts.
- Dynamic theme palette color inheritance for topological passing and merge lanes on canvas DAG renderers.
- Symmetrical cubic Bézier splines for smooth branch fork and merge lane routing.
- Enhanced accessibility with WCAG 2.1 AA dialog focus traps, modal backdrop outside-click dismissal, and keyboard focus preservation.
- Full test suite expansion to 42 comprehensive test suites with 100% pass rate.

### Changed
- Production security hardening: zero-leak repository rules, isolated documentation artifacts, and encrypted SecretStorage token persistence.
- Optimized canvas rendering performance and eliminated redundant layout computations.

## [0.4.7] - 2026-11-01

### Added
- Connect with your AI Studio: secure API key management, scoped permissions (read-only, read/write), SHA-256 hashed storage, and instant one-click connection configs for Claude Code, Google Antigravity, and generic MCP clients.
- Full MCP Server implementation supporting stdio and authenticated streamable HTTP/SSE transports (127.0.0.1, token auth, origin protection).
- Interactive Git Rebase Studio with drag-and-drop commit reordering, squash/drop/edit/reword/pick action selection, and pre-flight rebase simulation.
- Nested Git Submodule and Multi-Repository Workspace switcher with zero-child-process offline filesystem inspection.
- Virtual Scrolling DAG Engine maintaining less than 150 DOM nodes regardless of commit count (tested up to 100,000+ commits).
- WCAG 2.1 AA accessibility compliance: roving tabindex keyboard navigation (Arrow keys, PageUp/PageDown, Home/End, Enter), full ARIA treegrid roles, focus traps in all modal dialogs.
- Multi-language localization (English and Spanish) with parity validation.

### Changed
- Complete responsive design overhaul for all views across viewports from 280px narrow sidebars to full-screen editor windows.
- Replaced all unicode emoji markers with VS Code Codicons and theme-aware SVG assets.
- Hardened SecretStorage for all user tokens, personal access tokens, and generated AI keys.
- Optimized bundle size and .vscodeignore packaging rules for lean Marketplace distribution.
