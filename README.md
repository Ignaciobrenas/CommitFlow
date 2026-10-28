<p align="center">
  <img src="resources/logo-dark.png" width="320" alt="CommitFlow Logo" />
</p>

<h1 align="center">CommitFlow</h1>

<p align="center">
  <strong>The Ultimate Git Graph, Visual History, PR Launchpad & Multi-WIP Developer Hub for Visual Studio Code.</strong>
</p>

<p align="center">
  <a href="https://github.com/Ignaciobrenas/CommitFlow/actions"><img src="https://img.shields.io/badge/CI-Passing-10b981?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI Status" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Ignaciobrenas.commitflow"><img src="https://img.shields.io/badge/VS_Code_Marketplace-v0.4.5-38bdf8?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-8b5cf6?style=for-the-badge" alt="License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6_Strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
</p>

---

## ⚡ Overview

**CommitFlow** is a modern, high-performance Visual Studio Code extension built for software engineers who need instantaneous Git history visualization, deep inline blame, visual file evolution tracking, centralized PR triage, multi-worktree parallel workflows, and fast zero-push code sharing.

Whether you place CommitFlow in the **Bottom Panel (terminal dock)**, the **Left Primary Sidebar**, or the **Right Secondary Sidebar**, CommitFlow dynamically adapts its layout with dedicated ergonomic optimizations.

---

## 🚀 What's New in v0.4.5

### 1. 🎛️ Adaptive Layout Mode Switcher (Bottom Panel / Left / Right / Auto)
* **Custom Layouts for Every Placement:** Click the `$(layout)` button to switch between:
  * 💻 **Bottom Panel (Wide/Horizontal):** Two-column horizontal split screen with wide commit graph, side-by-side inspector, and inline stats.
  * 📱 **Left Sidebar:** Classical vertical sidebar with drawers sliding to the right.
  * 📱 **Right Sidebar:** Mirrored drawer architecture that slides inwards to the left, preventing off-screen cutoffs on narrow displays.
  * 🔄 **Auto (Responsive):** Real-time `ResizeObserver` detects container dimensions and automatically chooses the best layout.

### 2. 🔒 Private Repositories Deep Support
* **Multi-Platform Integration:** Advanced detection for private repositories across **GitHub**, **GitLab** (cloud & self-hosted), and **Bitbucket**.
* **Native VS Code Authentication:** Seamless integration with VS Code's GitHub auth session (`repo` scope) and token management for private Git instances.
* **Privacy Indicator Badge:** Header displays `🔒 GitHub Privado`, `🔒 GitLab Privado`, or `🔒 Bitbucket Privado` with glowing security status.

### 3. 🌿 Interactive Commit Graph (Retina Canvas & Zoom)
* **Continuous Multi-Lane DAG:** Computes cubic Bézier curves for incoming forks, merges, and continuous passing lanes.
* **Integrated Stashes & Tags:** View stash nodes and tag badges directly inside the commit graph.
* **Instant Multi-Filter Search:** Filter in real-time by commit subject, author name, email, branch, or SHA hash with zero latency.
* **Commit Inspector Drawer:** Inspect parent references, author metadata, full bodies, and one-click commit SHA copying.

### 4. 📄 Visual File History (File Evolution & Diffs)
* **Dedicated File Timeline:** Trace the entire lifecycle of any file in your project or currently open in the active editor.
* **Line Delta Metrics:** Visual pill badges indicating exact additions and deletions (`+24 -8`) per historical commit.
* **One-Click Native Diff Viewer:** Compare any historical revision directly against its parent commit or current working tree.

### 5. 🚀 Centralized PR Launchpad & Triage
* **Triage View:** Categorize Pull Requests / Merge Requests directly within VS Code:
  * 🔴 **Bloqueadas (Blocked):** Failing CI checks or changes requested by reviewers.
  * 🟢 **Listas (Ready to Merge):** Approved by reviewers with green CI/CD pipelines.
  * 🟡 **Pendientes (Pending Review):** Awaiting team reviews.
  * 👤 **Mis PRs:** Fast filter for your own authored pull requests.
* **One-Click Actions:** Instant local branch checkout, direct browser links, and clipboard URL copying.

### 6. 🌳 Worktrees & Multi-WIP Management
* **Simultaneous Branch Development:** Work on multiple branches concurrently using `git worktree` without stashing or changing folders.
* **Multi-WIP Change Detection:** Real-time indicator displaying whether each worktree has uncommitted modifications (`🟡 WIP Activo: 3 archivos`) or is clean (`🟢 Limpio`).
* **Worktree Lifecycle:** Create new worktrees with custom branch names and paths, open them in separate VS Code windows, or prune them safely.

### 7. ☁️ Cloud Patches (Zero-Push Private Sharing)
* **Instant Team Collaboration:** Share uncommitted changes or branch diffs with colleagues privately without polluting remote branches.
* **Self-Contained Unified Patches:** Create, preview, and copy formatted patches or shareable bundles to your clipboard with one click.
* **Safe Application:** Dry-run validation (`git apply --check`) prevents conflicts before applying or reversing patches.

### 8. 🎨 Pro Color Themes & Header Quick Switcher
* **Live Theme Switcher:** Click the `$(symbol-color)` button in the header or use settings to instantly switch themes without reloading:
  * 💛💜 **Cyberpunk:** Neon Yellow (`#ffe600`) and Deep Purple (`#110726`) with Magenta (`#d946ef`) accents.
  * 🧛 **Dracula:** Official Dracula palette (`#282a36`, `#bd93f9`, `#50fa7b`, `#8be9fd`, `#ff79c6`).
  * 🐙 **GitHub Dark:** Authentic GitHub code review palette (`#0d1117`, `#161b22`, `#58a6ff`, `#3fb950`).
  * 🌸 **Neon Pink:** Synthwave / Outrun glowing hot pink (`#ff2a85`) and vibrant turquoise (`#00f5d4`).
  * 🟢 **Neon Green:** Cyber Matrix terminal glowing emerald (`#00ff66`, `#39ff14`).
  * 🔵 **Neon Blue:** Tron electric cybernetic blue (`#00e5ff`, `#6366f1`).
  * 🌑 **Cyber Dark** & ☀️ **Clean Light** & 🔄 **Auto (Matches VS Code theme)**.
* **Chromatic Branch Lanes:** Every theme dynamically tunes the SVG Bézier curve lane palette to harmonize with the chosen colors.

### 9. 🛠️ Pro Developer Workflow & Git Tools
* 🍒 **Direct Cherry-Pick:** 1-click cherry-picking from row hover actions or inspector drawer into the current branch.
* ↩️ **Revert Commit:** Safe, clean commit reversal with instant verification.
* 🏷️ **Git Tagging Dialog:** Create annotated or lightweight release tags directly on any commit node.
* 📋 **Markdown Release Changelog:** Instant formatted Markdown changelog generation copied directly to your clipboard.
* ⏪ **Undo Last Commit (`git reset --soft HEAD~1`):** Safely roll back accidental commits without losing work staged in your index.

---

## 🏗️ System Architecture

```
src/
├── extension.ts               # Extension lifecycle, commands, and context menu bindings
├── avatars/
│   └── avatarService.ts       # Multi-tiered avatar resolver (Gravatar, GitHub, SVG)
├── blame/
│   ├── blameController.ts     # Debounced cursor tracker with cancellation tokens
│   ├── blameDecorator.ts      # Inline ghost text decorator (CommitFlow brand)
│   ├── blameHover.ts          # Rich interactive Markdown hover provider
│   └── blameStatusBar.ts      # Status bar controller
├── git/
│   ├── branchWatcher.ts       # Upstream change detector & interactive pull/rebase prompter
│   ├── gitClient.ts           # Git CLI runner (Worktrees, Cloud Patches, File History, Stash)
│   ├── gitContentProvider.ts  # TextDocumentContentProvider for historical file diffs
│   ├── gitParser.ts           # Incremental parser for git log, blame, refs
│   ├── githubService.ts       # Multi-remote provider (GitHub, GitLab, Bitbucket)
│   └── types.ts               # Core domain models (Worktrees, PRs, Cloud Patches, LayoutMode)
├── graph/
│   ├── graphLayout.ts         # Topological DAG solver with passing lanes & Bézier curves
│   └── graphWebviewProvider.ts# Webview View & Full Panel Provider with tab navigation & IPC
├── i18n/
│   └── locales.ts             # English & Spanish internationalization engine
├── mcp/
│   └── commitflowMcpServer.ts # Standalone MCP JSON-RPC stdio server for AI agents
├── utils/
│   └── lruCache.ts            # High-performance generic LRU cache with TTL
└── webview/
    ├── main.ts                # Retina canvas DAG, tab router, layout engine, PR launchpad
    └── style.css              # Cyber-clean adaptive theme system (Light/Dark, Layout Modes)
```

---

## ⚙️ Configuration Settings

Customize CommitFlow through VS Code Settings (`Ctrl+,` / `Cmd+,`):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `commitflow.graph.layoutMode` | `"auto"` | Panel orientation: `auto`, `bottom` (wide panel), `left` (sidebar), or `right` (secondary sidebar). |
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

## ⌨️ Commands & Shortcuts

| Command | Shortcut | Description |
| :--- | :--- | :--- |
| **CommitFlow: Open Graph** | `Ctrl + Alt + B` / `Cmd + Option + B` | Open full graph panel in editor |
| **CommitFlow: Show Visual File History** | Context Menu | Open timeline history of active file |
| **CommitFlow: Open PR Launchpad** | Command Palette | Open centralized PR triage board |
| **CommitFlow: Open Worktrees Manager** | Command Palette | Manage multi-WIP worktrees |
| **CommitFlow: Create Cloud Patch** | Command Palette | Create and copy instant code patch |
| **CommitFlow: Toggle Inline Blame** | Command Palette | Toggle line author annotations |
| **CommitFlow: Show Line Commit** | Context Menu | View commit details for current line |

---

## 🧪 Testing & Packaging

```bash
# Run automated test suite (17 suites)
npm test

# Run real repository live audit
npm run test:live

# Production bundle with esbuild
npm run build

# Package local .vsix extension
npm run package
```

---

## 📄 License

Developed with ❤️ by **Ignacio Brenas**. Released under the [MIT License](LICENSE).
