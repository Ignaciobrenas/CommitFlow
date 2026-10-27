<p align="center">
  <img src="resources/logo-dark.png" width="280" alt="CommitFlow Logo" />
</p>

<h1 align="center">CommitFlow</h1>

<p align="center">
  <strong>High-Performance Git Commit & Branch Graph Visualizer with GitLens-Grade Multi-Lane DAG, Real-Time Deep Line Blame, Stash Manager, Upstream Rebase/Merge/Pull & Author Avatar Insights for Visual Studio Code.</strong>
</p>

<p align="center">
  <a href="https://github.com/Ignaciobrenas/commitflow/actions"><img src="https://img.shields.io/badge/CI-Passing-10b981?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI Status" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Ignaciobrenas.commitflow"><img src="https://img.shields.io/badge/VS_Code_Marketplace-v0.3.0-38bdf8?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8b5cf6?style=for-the-badge" alt="License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6_Strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
</p>

---

## ⚡ Overview

**CommitFlow** is an enterprise-grade Visual Studio Code extension built for developers who demand lightning-fast Git history visualization, zero-lag inline authorship auditing, native file diff inspections, interactive stash management, upstream branch synchronizations, and deep branch intelligence directly inside their editor.

Unlike legacy Git extensions that freeze the UI or consume hundreds of megabytes in large monorepos, CommitFlow features a **dual-runtime decoupled architecture** with **HTML5 Canvas virtual windowing**, **multi-tier LRU caching with document save invalidation**, and **cooperative process cancellation**.

CommitFlow is fully compatible with **Windows, macOS, Linux, and WSL (Windows Subsystem for Linux)** with automated path normalization.

---

## ✨ Key Features

### 1. 🌿 GitLens-Grade Interactive Commit & Branch Graph (Webview)
* **True Continuous Multi-Lane DAG:** Automatically assigns distinct chromatic lanes to branches, computing cubic Bézier curves for incoming forks, outgoing merges, and continuous passing lane bypass lines.
* **Retina High-DPI Canvas Rendering:** Pixel-perfect crisp lines and glowing commit beacons scaled to `window.devicePixelRatio`.
* **Interactive Branch Pathway Highlighting:** Hover over any commit or branch badge to illuminate its entire lineage and history while gently dimming unrelated branches.
* **Theme-Adaptive Transparent Logos:** Automatically displays the white transparent logo in Dark/High Contrast themes and the tech emblem logo in Light themes.
* **Instant Filtering & Search:** Search by author, email, commit subject, or SHA hash in real time with zero latency.
* **Commit Inspector Drawer:** Slide-in drawer with author metadata, parent commit references, full commit bodies, and one-click SHA copying.
* **One-Click Branch Checkout:** Instant branch switching directly from the toolbar or graph view.

### 2. ⚡ Upstream Sync Bar & Single-Click Rebase/Merge/Pull
* **Upstream Synchronization Indicator:** Detects when your current branch is ahead or behind its upstream tracking branch.
* **Interactive One-Click Actions:** Direct `[Rebase]`, `[Merge]`, and `[Pull]` buttons in the graph toolbar when commits are pending.
* **Interactive Merge & Change Notifications:** Non-intrusive notifications when remote changes or merged branches are detected, with one-click resolution.

### 3. 📦 Full Git Stash Management
* **Stash Manager Modal:** Access stashes with the `<i class="codicon codicon-archive"></i>` toolbar button or stats counter.
* **Save, Apply, Pop, and Drop:** Create named stashes with custom messages and inspect, apply, pop, or drop them directly from the UI without touching the command line.

### 4. 🔍 Integrated Native VS Code Diff Viewer
* **Virtual Document Provider (`commitflow-revision:`):** View historical diffs without creating temporary files on disk.
* **File Change Breakdown:** Inspect which files were Modified (`M`), Added (`A`), Deleted (`D`), or Renamed (`R`) in any historical commit.
* **Side-by-Side Diffs:** Clicking any changed file launches VS Code's native diff editor instantly.

### 5. 👤 Deep Author & Contributor Analytics
* **Automatic Avatar Resolution:** Resolves author profile pictures by email using Gravatar (MD5) and GitHub noreply email mapping.
* **Dynamic Vector Initials Fallback:** Generates high-resolution vector SVG initials with curated gradient palettes for offline environments.
* **Repository Statistics Bar:** Real-time counter of total commits, total contributors, stashes, and active branches with top contributor mini-avatars that act as one-click filters.

### 6. 🕵️ Zero-Lag Live Inline Blame & Editor Branding
* **Clear Editor Brand Presence:** Visible in the code editor via inline blame: `⎇ CommitFlow › Author • RelativeTime • Summary`.
* **Status Bar Item:** Clickable status bar widget: `$(git-branch) CommitFlow: Author, RelativeTime`.
* **Editor Title Action:** `$(git-branch)` "CommitFlow: Open Graph" button in the upper right navigation of every open editor tab.
* **Cooperative Cancellation (`CancellationToken`):** Rapid cursor movement automatically kills active Git sub-processes, preventing event loop starvation.

### 7. 🤖 Model Context Protocol (MCP) Server for AI Assistants
* **AI Tool Integration:** Exposes tools (`commitflow_get_user_impact`, `commitflow_get_active_context`, `commitflow_get_commit_history`, `commitflow_get_line_blame`, `commitflow_get_repo_summary`) and resources (`commitflow://repo/user-context`, `commitflow://repo/graph-summary`) so AI assistants can understand developer impact and repository state.

---

## 🏗️ System Architecture

```
src/
├── extension.ts               # Extension lifecycle entry point & command bindings
├── avatars/
│   └── avatarService.ts       # Multi-tiered avatar resolver (Gravatar, GitHub, SVG)
├── blame/
│   ├── blameController.ts     # Debounced cursor tracker with cancellation tokens
│   ├── blameDecorator.ts      # Inline ghost text decorator (CommitFlow brand)
│   ├── blameHover.ts          # Rich interactive Markdown hover provider
│   └── blameStatusBar.ts      # Status bar controller
├── git/
│   ├── branchWatcher.ts       # Upstream change detector & interactive pull/rebase prompter
│   ├── gitClient.ts           # Stream Git CLI runner (Stash, Rebase, Merge, WSL path normalization)
│   ├── gitContentProvider.ts  # TextDocumentContentProvider for historical file diffs
│   ├── gitParser.ts           # Incremental parser for git log, blame, refs
│   └── types.ts               # Core domain interfaces (CommitFlowSettings, Stashes, DAG lanes)
├── graph/
│   ├── graphLayout.ts         # Topological DAG solver with passing lanes & Bézier curves
│   └── graphWebviewProvider.ts# Webview View & Full Panel Provider with secure CSP
├── i18n/
│   └── locales.ts             # Complete English & Spanish internationalization engine
├── mcp/
│   └── commitflowMcpServer.ts # Standalone MCP JSON-RPC stdio server for AI agents
├── utils/
│   └── lruCache.ts            # High-performance generic LRU cache with TTL & prefix deletion
└── webview/
    ├── main.ts                # Retina canvas DAG renderer, Stash manager, Upstream sync bar
    └── style.css              # Adaptive theme design system (Light/Dark, Codicons)
```

---

## ⚙️ Configuration Settings

Customize CommitFlow through VS Code Settings (`Ctrl+,` / `Cmd+,`):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `commitflow.language` | `"auto"` | Interface language: auto, Spanish (`es`), or English (`en`). |
| `commitflow.graph.theme` | `"auto"` | Color theme: auto (matches VS Code), dark, or light. |
| `commitflow.graph.density` | `"comfortable"` | Row density: compact (22px), comfortable (26px), spacious (32px). |
| `commitflow.graph.pageSize` | `300` | Maximum number of commits loaded per batch in the graph view. |
| `commitflow.graph.animations` | `true` | Enable smooth branch transitions and hover glow effects. |
| `commitflow.inlineBlame.enabled` | `true` | Show author and commit info at the end of the current line. |
| `commitflow.inlineBlame.delay` | `120` | Debounce delay in milliseconds before calculating blame on cursor movement. |
| `commitflow.avatars.enabled` | `true` | Enable author profile pictures and avatar resolution. |
| `commitflow.avatars.service` | `"gravatar"` | Avatar provider (`gravatar`, `github`, `initials`). |
| `commitflow.sync.autoFetch` | `true` | Periodically poll remote repository changes in background. |
| `commitflow.sync.fetchIntervalMinutes` | `5` | Auto-fetch interval in minutes (0 to disable). |
| `commitflow.sync.notifyOnBranchMerge` | `true` | Notify when upstream branches change or are merged. |

---

## ⌨️ Keyboard Shortcuts

| Command | Windows / Linux | macOS |
| :--- | :--- | :--- |
| **Open CommitFlow Graph** | `Ctrl + Alt + B` | `Cmd + Option + B` |
| **Toggle Inline Blame** | Command Palette | Command Palette |
| **Show Line Commit Details** | Context Menu | Context Menu |

---

## 🧪 Testing & Packaging

```bash
# Run automated test suite
npm test

# Run real repository live audit
npm run test:live

# Production build with esbuild
npm run build

# Package local .vsix extension
npm run package
```

---

## 📄 License

Developed with ❤️ by **Ignacio Brenas**. Released under the [MIT License](LICENSE).
