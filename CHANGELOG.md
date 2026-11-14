# Change Log

All notable changes to the "commitflow" extension will be documented in this file.

## [1.0.0] - 2026-11-14

### Added
- **Design System & Agent Skills**: Created root `DESIGN.md` visual system and `.claude/skills/` suites (`commitflow-ui-design`, `commitflow-canvas-dag`, `commitflow-qa-testing`, `commitflow-issue-workflow`) plus custom `--vscode-*` UI primitives (`CfButton`, `CfBadge`, `CfDrawer`, `CfTabs`, `CfToast`, `CfSkeleton`) with zero deprecated `@vscode/webview-ui-toolkit` dependencies.
- **DAG Minimap, Filters, Drag-and-Drop & Onboarding**: Interactive canvas minimap, combined `--first-parent`/date/path/remote filters, quick `Jump to HEAD`/`Jump to Bisect Probe`, drag-and-drop branch reset & commit cherry-pick/rebase workflows, illustrated empty states, and initial skeleton loaders.
- **Offline Binary `.git` Engine & Submodules**: Completed binary loose object decompression, packfile v2 (`0xff744f63`) + `OFS_DELTA`/`REF_DELTA` decoding, `.git/index` (`DIRC` v2/v3/v4) staging inspection, `.gitmodules` nested submodule discovery, `gitdir:` worktree linking, SHA-256 detection, and `reftable` detection.
- **Web Worker / OffscreenCanvas & Virtualization**: Off-thread topological DAG computation via `DagWorkerEngine`, DOM row recycling pool, adaptive `FileSystemWatcher` debouncer, and batched webview IPC dispatch.
- **Conflict Resolution Studio, Conventional Commits & Remote Parity**: Interactive Conflict Resolution Studio integrated with VS Code 3-way Merge Editor (`git.openMergeEditor`), Conventional Commits Builder with `.gitmessage` loading and live `#issue` autocomplete, plus GitHub/GitLab/Forgejo TTL-cached PR/MR inline comments, approvals, CI status checks, and triage.
- **Security Hardening & MCP Audit Trail**: Strict CSP nonces, `IpcSchemaValidator` runtime command allowlist + path-traversal/prototype-pollution guard, sliding-window MCP HTTP rate limiter (`429 Retry-After`), and circular `McpAuditRingBuffer` exposed via `commitflow://mcp/audit-log`.
- **Enterprise QA Pyramid (50 Suites)**: Added 1,050 deterministic seeded fuzzing iterations (`test/fuzzTests.ts`), real-repo MCP stdio/HTTP/SSE end-to-end suite (`test/mcpE2eTests.ts`), 50,000-commit synthetic DAG benchmark (`scripts/benchmark-50k.js`), headless extension lifecycle smoke runner (`scripts/run-e2e-smoke.js`), and expanded Edge CDP audit matrix (`64/64` across 4 themes × 4 views × 4 breakpoints with WCAG 2.1 AA treegrid/ARIA validation).

### Fixed
- Eliminated an $O(N^2)$ converging-lane memory leak in `GraphLayout.compute` by clearing duplicate converging commit pointers across active lanes (50,000 commits now lay out in ~28 ms sync / ~15 ms worker with ~38 MB heap delta).
- Fixed `IssueBranchLinker.createSlug` leading-hyphen sanitization edge case and extended `IpcSchemaValidator` payload scanning across entire IPC message envelopes.

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
