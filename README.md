<p align="center">
  <img src="resources/commitflow-logo-color.png" width="160" height="160" alt="CommitFlow Logo" />
</p>

<h1 align="center">CommitFlow</h1>

<p align="center">
  <strong>Enterprise-Grade Git Graph Visualization, Direct Filesystem Engine, Multi-Provider Hub, and Model Context Protocol Server for Visual Studio Code.</strong>
</p>

<p align="center">
  <a href="https://github.com/Ignaciobrenas/CommitFlow/actions"><img src="https://img.shields.io/badge/Build-Passing-10b981?style=flat-square&logo=githubactions&logoColor=white" alt="Build Status" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=Ignaciobrenas.commitflow"><img src="https://img.shields.io/badge/Marketplace-v0.4.5-0284c7?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code Marketplace" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-6366f1?style=flat-square" alt="License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6_Strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
</p>

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Core Features](#core-features)
  - [Topological Commit Graph](#topological-commit-graph)
  - [Direct Filesystem Offline Engine](#direct-filesystem-offline-engine)
  - [Unified Remote Providers: Forgejo, Gitea, GitHub, GitLab](#unified-remote-providers-forgejo-gitea-github-gitlab)
  - [Universal SSH and OpenSSH Parser](#universal-ssh-and-openssh-parser)
  - [Fork Desktop Client Interoperability](#fork-desktop-client-interoperability)
  - [Issue Tracker Hub and Issue-to-Code Workflow](#issue-tracker-hub-and-issue-to-code-workflow)
  - [Pull Request and Merge Request Triage](#pull-request-and-merge-request-triage)
  - [Git Worktree Management and Multi-WIP Tracking](#git-worktree-management-and-multi-wip-tracking)
  - [Visual File Evolution and Line Delta Tracking](#visual-file-evolution-and-line-delta-tracking)
  - [Cloud Patches (Zero-Push Collaboration)](#cloud-patches-zero-push-collaboration)
  - [Inline Blame and Author Contributions](#inline-blame-and-author-contributions)
  - [GPG and OpenSSH Cryptographic Signature Verification](#gpg-and-openssh-cryptographic-signature-verification)
  - [Visual Git Reflog Time Machine and Lost-Commit Recovery](#visual-git-reflog-time-machine-and-lost-commit-recovery)
  - [Multi-Commit Diff Comparison Engine](#multi-commit-diff-comparison-engine)
  - [Repository Health and Garbage Collection Diagnostics](#repository-health-and-garbage-collection-diagnostics)
  - [Visual Git Bisect Assistant and Regression Hunter](#visual-git-bisect-assistant-and-regression-hunter)
  - [Pre-Flight Cherry-Pick Conflict Forecaster](#pre-flight-cherry-pick-conflict-forecaster)
  - [Adaptive Universal Responsive Layout Engine](#adaptive-universal-responsive-layout-engine)
  - [Model Context Protocol (MCP) Server](#model-context-protocol-mcp-server)
- [Installation and Prerequisites](#installation-and-prerequisites)
- [Getting Started](#getting-started)
- [Configuration Reference](#configuration-reference)
- [Forgejo and Gitea Integration Guide](#forgejo-and-gitea-integration-guide)
- [SSH and OpenSSH Alias Resolution Guide](#ssh-and-openssh-alias-resolution-guide)
- [Model Context Protocol (MCP) Setup](#model-context-protocol-mcp-setup)
- [Keyboard Shortcuts and Command Reference](#keyboard-shortcuts-and-command-reference)
- [Offline Architecture and Direct .git Inspection](#offline-architecture-and-direct-git-inspection)
- [Developer Workflow Operations](#developer-workflow-operations)
- [Troubleshooting and FAQ](#troubleshooting-and-faq)
- [Building from Source](#building-from-source)
- [Security, Privacy, and Telemetry](#security-privacy-and-telemetry)
- [License](#license)

---

## Architectural Overview

CommitFlow is a high-performance Visual Studio Code extension engineered for software developers, teams, and artificial intelligence agents that require instantaneous Git repository analysis, complex branch topology visualization, and deep hosting provider integration.

Unlike traditional Git graph extensions that depend exclusively on synchronous command-line subprocesses and remote network connections, CommitFlow combines a multi-tier runtime architecture:

```text
+---------------------------------------------------------------------------------------+
|                                VISUAL STUDIO CODE HOST                                |
|                                                                                       |
|  +--------------------+   +-----------------------+   +----------------------------+  |
|  |  Primary Activity  |   |     Bottom Panel      |   |    Secondary Sidebar       |  |
|  |   Bar Container    |   |     Terminal Dock     |   |     (Mirrored Drawers)     |  |
|  +---------+----------+   +-----------+-----------+   +--------------+-------------+  |
|            |                          |                              |                |
|            +--------------------------+------------------------------+                |
|                                       |                                               |
|                                       v                                               |
|                    +------------------------------------+                             |
|                    |   GraphWebviewProvider (CSP Safe)  |                             |
|                    +------------------+-----------------+                             |
|                                       |                                               |
+---------------------------------------|-----------------------------------------------+
                                        | IPC Messages / RPC
+---------------------------------------v-----------------------------------------------+
|                                COMMITFLOW CORE CORE                                   |
|                                                                                       |
|  +----------------------+  +---------------------+  +------------------------------+  |
|  |    RemoteManager     |  |   IssueService &    |  |       GitFsReader            |  |
|  | (Forgejo/Gitea/GH/GL)|  |  BranchLinker Engine|  | (Direct Disk .git Parser)    |  |
|  +----------+-----------+  +----------+----------+  +--------------+---------------+  |
|             |                         |                            |                  |
|  +----------v-----------+  +----------v----------+  +--------------v---------------+  |
|  |   SshConfigParser    |  | Fork Client Bridge  |  |       GitClient              |  |
|  |  (~/.ssh/config)     |  |  (State Sync/CLI)   |  | (Non-blocking Batch Exec)   |  |
|  +----------+-----------+  +----------+----------+  +--------------+---------------+  |
|             |                         |                            |                  |
|  +----------v-------------------------v----------------------------v---------------+  |
|  |               PersistenceManager (SecretStorage / VS Code Settings)             |  |
|  +------------------------------------+--------------------------------------------+  |
|                                       |                                               |
|  +------------------------------------v--------------------------------------------+  |
|  |          Model Context Protocol Server (JSON-RPC 2.0 via Stdio)                 |  |
|  |           Exposes Tools, Resources, and Prompts to External AI Agents            |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## Core Features

### Topological Commit Graph

- **Topological Multi-Lane Layout:** Uses a continuous Directed Acyclic Graph (DAG) sorting algorithm to allocate lane indices without line crossings.
- **Retina Bézier Spline Renderer:** Computes cubic Bézier paths for incoming forks, merges, and continuous branch trajectories.
- **Adaptive Layout Modes:**
  - **Bottom Panel (Wide Split):** Dual-column layout optimized for wide desktop screens and dock placement below the code editor.
  - **Left Sidebar:** Classical single-column view with slide-out details.
  - **Right Sidebar:** Mirrored drawer architecture that slides inwards to the left, preventing display cut-offs on narrow monitors.
  - **Auto Responsive:** Automatically determines the layout mode based on the current container dimensions via `ResizeObserver`.
- **Integrated Tags and Stashes:** Renders release tags, lightweight tags, and stash revisions inline within the DAG.
- **Instant Search and Filtering:** Filter commits in real time by author name, email, commit message, branch name, or SHA-1 hash.

### Direct Filesystem Offline Engine

CommitFlow contains a built-in filesystem parser (`GitFsReader`) that reads the contents of the `.git` directory directly from disk without spawning child processes and without requiring an internet connection.

- **Zero-Process Execution:** Reads repository state in sandboxed, restricted, or remote container environments where the `git` binary is missing or constrained.
- **Data Extracted Offline:**
  - Reference resolution via `.git/HEAD`, `.git/refs/heads/*`, `.git/refs/tags/*`, and `.git/refs/remotes/*`.
  - Packed references resolution via `.git/packed-refs` including peeled annotated tag objects (`^{}`).
  - Configuration inspection via `.git/config` (parsing remotes, push URLs, branch upstreams, and user credentials).
  - Reflog commit extraction from `.git/logs/HEAD` providing chronological commit history without executing `git log`.
  - In-flight operation detection: `.git/MERGE_HEAD` (merge in progress), `.git/CHERRY_PICK_HEAD` (cherry-pick), `.git/REVERT_HEAD` (revert), and `.git/rebase-merge/` or `.git/rebase-apply/` (interactive or standard rebase state, steps, and head names).
  - Local stash log parsing via `.git/logs/refs/stash`.
  - Linked worktrees discovery via `.git/worktrees/*`.

### Unified Remote Providers: Forgejo, Gitea, GitHub, GitLab

CommitFlow features a polymorphic provider architecture (`RemoteProvider`) capable of interfacing with public platforms, self-hosted instances, and air-gapped enterprise servers.

- **Deep Forgejo and Gitea Support:**
  - Fully compatible with the Forgejo / Gitea API v1 specification (`/api/v1`).
  - Automatic instance detection via hostname heuristics and silent `/api/v1/version` validation.
  - Secure credential storage in VS Code `SecretStorage` keyed by host name (`commitflow.token.forgejo.<host>`).
  - Read and write support for issues, comments, issue state toggles (open/closed), milestones, labels, and pull requests.
  - Commit CI status inspection via `/api/v1/repos/{owner}/{repo}/statuses/{sha}`.
  - Local LRU caching layer ensuring issues and pull requests remain accessible even when the network is interrupted.
- **GitHub and GitLab Integration:**
  - Native VS Code authentication session integration (`repo` scope).
  - Private repository detection with dedicated status badges (`GitHub Private`, `GitLab Private`, `Forgejo Private`).

### Universal SSH and OpenSSH Parser

Resolves Git remote configurations across standard, customized, and complex SSH network topologies:

- **Supported URL Schemes:**
  - Standard SCP syntax: `git@forgejo.example.com:organization/repository.git`
  - Explicit SSH with custom port: `ssh://git@forgejo.example.com:2222/organization/repository.git`
  - HTTPS / HTTP: `https://forgejo.example.com/organization/repository.git`
  - Local filesystem paths: `/var/git/repository.git`
- **OpenSSH Configuration Resolver:**
  - Parses `~/.ssh/config` (or a custom path configured in settings).
  - Resolves host aliases (for example, `Host forgejo-box` mapped to `HostName 192.168.1.100`, `Port 2222`, `User git`, `IdentityFile ~/.ssh/id_ed25519`).
- **Non-Blocking SSH Execution:**
  - Injects `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"` into child processes.
  - Prevents background fetchers (`autoFetch`) from hanging when an SSH prompt or unknown host fingerprint is encountered.
  - Automatically preserves and forwards system SSH agent sockets (`SSH_AUTH_SOCK`).

### Fork Desktop Client Interoperability

CommitFlow integrates directly with the Fork Git desktop client (`Fork.exe` on Windows, `/Applications/Fork.app` on macOS, and Linux):

- **Shared State Synchronization:** Reads conflict states, active rebases, and merge heads initiated within Fork.
- **One-Click Bridge:** Launches the active repository or worktree directly in Fork via local binary discovery or the `fork://open` custom URI protocol.

### Issue Tracker Hub and Issue-to-Code Workflow

A dedicated navigation hub (`Issues`) integrated directly into the extension view:

- **Assigned to Me:** Fetches open issues assigned to the authenticated developer from Forgejo, GitHub, or GitLab.
- **Branch and Commit Association:**
  - Automatically identifies issues associated with the active branch by analyzing branch patterns (such as `feat/issue-42-login` or `fix/#108-auth`).
  - Scans unpushed local commit messages for references like `Closes #42` or `Refs #108`.
  - Displays the linked issue in a prominent banner above the issue list.
- **Issue-to-Code Actions:**
  - **Create Branch / Worktree:** One-click branch creation using customizable templates (default: `feat/{id}-{slug}`) or provisioning of a parallel Git worktree.
  - **Insert Reference:** Injects `Closes #<id>` into the commit preparation buffer or clipboard.
  - **Lateral Inspector Drawer:** View markdown-rendered descriptions, comment feeds, label chips, and milestone deadlines. Post comments or change status directly from VS Code.
  - **Interactive Hover Cards:** Hovering over `#<id>` in commit messages or file blame annotations displays a hover card with title, author, labels, and state.

### Pull Request and Merge Request Triage

- **Triage Columns:** Classifies active pull requests into four distinct status groups:
  - **Blocked:** Failing continuous integration pipelines or changes requested by reviewers.
  - **Ready:** Approved by reviewers with green CI/CD status.
  - **Pending:** Awaiting initial or peer reviews.
  - **Mine:** Authored by the current authenticated user.
- **Quick Actions:** One-click checkout of remote head branches, direct browser links, and clipboard URL copying.

### Git Worktree Management and Multi-WIP Tracking

- **Concurrent Branch Work:** Work on multiple branches simultaneously in isolated directories without stashing or switching branches.
- **Dirty Working Tree Detection:** Identifies whether each linked worktree has uncommitted modifications or is clean.
- **Worktree Lifecycle Operations:** Add new worktrees, open worktrees in new VS Code windows, and prune stale worktree references.

### Visual File Evolution and Line Delta Tracking

- **File History View:** Trace the historical revisions of any file in the workspace or the currently active editor tab.
- **Line Delta Badges:** Displays added (`+N`) and deleted (`-N`) line metrics per revision.
- **Native Diff Integration:** Launch side-by-side comparative diffs against parent commits or the working tree with a single click.

### Cloud Patches (Zero-Push Collaboration)

- **Share Uncommitted Changes:** Generate self-contained patch bundles from staged or working tree diffs.
- **Dry-Run Validation:** Verifies patch integrity using `git apply --check` before applying changes.
- **Reverse Patch Application:** Safely roll back applied patch bundles.

### Inline Blame and Author Contributions

- **Inline Ghost Text:** Displays discreet inline blame annotations at the end of the active cursor line.
- **Status Bar Integration:** Shows the commit author, relative timestamp, and commit SHA in the VS Code status bar.
- **Personal Contribution Analytics:** Calculates total commits, participation percentages across repository branches, and active contributor rankings.

### GPG and OpenSSH Cryptographic Signature Verification

- **Dual Cryptographic Parsing:** Evaluates commit signatures generated via GNU Privacy Guard (OpenPGP/GPG) and OpenSSH signature keys (`ssh-keygen -Y sign`).
- **Signature Status Classification:** Categorizes commits as `valid`, `invalid`, `untrusted`, or `none` by extracting `%G?`, `%GS`, and `%GK` tokens.
- **Visual Verification Badges:** Displays verified shields in wide and compact views with detailed popover banners indicating key IDs, signer names, and validity statuses.

### Visual Git Reflog Time Machine and Lost-Commit Recovery

- **Chronological Reference Log:** Renders full movements of `HEAD` recorded in `.git/logs/HEAD` (or via `git reflog`), tracing checkouts, merges, soft/hard resets, rebases, and orphaned commits.
- **One-Click Branch Recovery:** Allows immediate creation of a new branch from any orphaned or historically discarded commit hash, preventing accidental data loss.
- **Zero-Process Direct Disk Fallback:** Operates directly over raw filesystem logs when external processes are unavailable.

### Multi-Commit Diff Comparison Engine

- **Arbitrary Revision Range Inspection:** Select any historical commit and compare it against `HEAD` or any secondary revision.
- **Unified Change Metrics:** Summarizes total additions (`+N`), deletions (`-M`), and files altered across the range, including a list of intermediate commits.
- **Integrated File Level Diffs:** Click on any modified file in the comparison modal to open side-by-side diff editors in Visual Studio Code.

### Repository Health and Garbage Collection Diagnostics

- **Storage Metrics Inspection:** Analyzes total repository size on disk, loose object counts, packfile counts, and dangling commit objects.
- **Proactive Maintenance Advisories:** Alerts developers when loose objects or unreferenced commits exceed performance thresholds.
- **One-Click Git Garbage Collection:** Triggers `git gc --prune=now --quiet` directly from the user interface to optimize repository packfiles and reclaim disk storage.

### Visual Git Bisect Assistant and Regression Hunter

- **Interactive Binary Search Navigation:** Initiates, steps through, and resolves Git Bisect sessions directly within the graph view.
- **Head-Up Status Banner:** Displays the current revision under evaluation, active bad and good boundaries, and an approximate estimation of remaining diagnostic steps.
- **One-Click State Transitions:** Developers can mark commits as Good, Bad, Skip (for unbuildable intermediate revisions), or Abort directly via top-level buttons.
- **Topological DAG Highlighting:** The active probe commit pulses with a distinctive cyan highlight, while confirmed good commits receive emerald tags and confirmed bad commits receive crimson markers.
- **Offline Direct Filesystem State Inspection:** In air-gapped or process-restricted workspaces, `GitFsReader` inspects `.git/BISECT_START`, `.git/BISECT_EXPECTED_REV`, and `.git/refs/bisect/*` markers to restore state without terminal calls.

### Pre-Flight Cherry-Pick Conflict Forecaster

- **In-Memory Three-Way Merge Tree Simulation:** Executes non-destructive `git merge-tree` analysis prior to altering the working directory or staging index.
- **Collision Risk Warning Modal:** If conflicts are anticipated, CommitFlow interrupts execution and displays the exact conflicting file paths in an advisory dialog.
- **Safe Force-Apply Mode:** Gives the developer the choice to proceed into standard conflict resolution or abort with zero working directory pollution.

### Adaptive Universal Responsive Layout Engine

- **Full Multi-Dock Placement Support:** Architected to adapt to any Visual Studio Code window configuration, including the Primary Left Activity Bar, Secondary Right Sidebar, Bottom Terminal Dock, Editor Tabs, and detached Popout auxiliary windows.
- **Multi-Tier Viewport Breakpoints:** Automatically optimizes layout metrics across standard (>600px), compact (440px - 600px), sidebar compact (260px - 440px), and ultra-narrow nano viewports (<= 260px).
- **Collapsing Navigation Tab Bar:** On narrow sidebars, tab titles collapse smoothly into icon-only pills with native hover tooltips, allowing all primary navigation views to fit without horizontal wrapping.
- **Dual-Pane Bottom Dock Split:** In bottom panel placement, graph visualization and inspector drawers run side-by-side in dual-column split mode, avoiding intrusive overlay obstructions.
- **Clamped Floating Overlays:** Popovers, tooltips, and inspector drawers dynamically calculate boundary clamping against window edges, preventing off-screen clipping on compact sidebars.

### Model Context Protocol (MCP) Server

CommitFlow includes a built-in Model Context Protocol server (`CommitFlowMcpServer`) compliant with the JSON-RPC 2.0 specification. Any MCP client (such as Claude Desktop, Cursor IDE, or custom agent systems) can query repository state, execute operations, and read structured resources over stdio.

---

## Installation and Prerequisites

### Prerequisites

- **Visual Studio Code:** Version `1.85.0` or higher.
- **Git:** Version `2.23.0` or higher recommended (with support for `git merge-tree --write-tree` and `git worktree`).
- **OpenSSH Client:** Standard on Linux, macOS, and modern Windows 10/11 installations.

### Installation via Marketplace

1. Open Visual Studio Code.
2. Press `Ctrl+P` (or `Cmd+P` on macOS) and run:
   ```bash
   ext install Ignaciobrenas.commitflow
   ```
3. Alternatively, search for **CommitFlow** in the Extensions view (`Ctrl+Shift+X`).

### Manual Installation from VSIX Package

To install a pre-built `.vsix` release:

```bash
code --install-extension commitflow-0.4.5.vsix
```

---

## Getting Started

1. Open any directory or workspace containing a Git repository in Visual Studio Code.
2. Click on the **CommitFlow** icon in the Activity Bar or press `Ctrl+Shift+P` and execute:
   ```text
   CommitFlow: Open Graph View
   ```
3. To open CommitFlow in the Bottom Panel (terminal dock), run:
   ```text
   CommitFlow: Open CommitFlow Hub in Bottom Panel
   ```
4. Click on any commit in the graph to inspect parent links, file changes, author metadata, and unified diffs.

---

## Configuration Reference

CommitFlow can be configured through the VS Code Settings editor (`Ctrl+,`) or directly within your `.vscode/settings.json` file.

| Setting Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `commitflow.layout.placement` | `string` | `"auto"` | Layout display mode. Options: `"auto"`, `"bottom"`, `"left"`, `"right"`. |
| `commitflow.graph.rowHeight` | `number` | `28` | Row height in pixels for the commit graph canvas. |
| `commitflow.graph.defaultTheme` | `string` | `"auto"` | Graph color palette. Options: `"auto"`, `"cyberpunk"`, `"dracula"`, `"github-dark"`, `"neon-pink"`, `"neon-green"`, `"neon-blue"`, `"clean-light"`. |
| `commitflow.blame.enabled` | `boolean` | `true` | Enables inline blame annotations on the active editor line. |
| `commitflow.blame.showAuthor` | `boolean` | `true` | Displays author name in the inline blame annotation. |
| `commitflow.blame.showDate` | `boolean` | `true` | Displays relative or formatted date in inline blame. |
| `commitflow.blame.dateFormat` | `string` | `"relative"` | Date formatting style: `"relative"`, `"iso"`, or `"locale"`. |
| `commitflow.sync.autoFetch` | `boolean` | `true` | Enables non-blocking background fetching for active remotes. |
| `commitflow.sync.fetchIntervalMinutes` | `number` | `5` | Interval in minutes between background fetch cycles. |
| `commitflow.issues.defaultFilter` | `string` | `"assignedToMe"` | Default filter in the Issue Tracker: `"assignedToMe"`, `"allOpen"`, `"closed"`. |
| `commitflow.issues.branchNamingPattern`| `string` | `"feat/{id}-{slug}"`| Template used when generating branch names from issues. |
| `commitflow.remotes.sshConfigPath` | `string` | `"~/.ssh/config"` | Filesystem path to the OpenSSH configuration file. |
| `commitflow.remotes.forgejoInstances` | `array` | `[]` | List of self-hosted Forgejo or Gitea base URLs or hostnames. |
| `commitflow.remotes.enableForkIntegration`| `boolean`| `true` | Enables detection and integration with the Fork desktop client. |
| `commitflow.mcp.port` | `number` | `0` | Port for optional TCP MCP connections (0 defaults to stdio). |

---

## Forgejo and Gitea Integration Guide

CommitFlow provides native, deep integration with self-hosted **Forgejo** and **Gitea** instances.

### 1. Generating a Personal Access Token

1. Log into your Forgejo/Gitea instance in a web browser.
2. Navigate to **Settings** -> **Applications** -> **Manage Access Tokens**.
3. Generate a new token with the following scopes:
   - `issue` (Read and Write)
   - `repository` (Read and Write)
4. Copy the generated token string.

### 2. Storing the Token in CommitFlow

1. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run:
   ```text
   CommitFlow: Configure Remote Access Token
   ```
3. Enter the hostname of your Forgejo instance (for example, `forgejo.internal.corp` or `git.domain.com:2222`).
4. Paste your Personal Access Token.
5. The token is encrypted and securely stored in VS Code's `SecretStorage` under the key:
   ```text
   commitflow.token.forgejo.<hostname>
   ```

### 3. Configuring Custom Hostnames in Settings

If your Forgejo instance runs on a private domain, IP address, or custom port, add it to your VS Code `settings.json`:

```json
{
  "commitflow.remotes.forgejoInstances": [
    "forgejo.internal.corp",
    "git.domain.com:2222",
    "http://192.168.1.50:3000"
  ]
}
```

CommitFlow will automatically associate repositories from these domains with the `ForgejoProvider`, fetch assigned issues, resolve user mentions, and display the `Forgejo Private` security badge.

---

## SSH and OpenSSH Alias Resolution Guide

CommitFlow automatically resolves custom SSH configurations defined in your OpenSSH configuration file (`~/.ssh/config`).

### Sample OpenSSH Configuration

```text
# ~/.ssh/config

# Standard Forgejo server with custom SSH port
Host my-forgejo
  HostName git.company.internal
  Port 2222
  User git
  IdentityFile ~/.ssh/id_ed25519_forgejo
  IdentitiesOnly yes

# Air-gapped development server
Host lab-git
  HostName 10.0.4.15
  Port 22
  User git
  IdentityFile ~/.ssh/id_rsa_lab
```

### Git Remote Configurations

When your repository's `.git/config` references an alias:

```ini
[remote "origin"]
  url = git@my-forgejo:organization/microservice.git
  fetch = +refs/heads/*:refs/remotes/origin/*
```

CommitFlow performs the following resolution steps:
1. Detects that `my-forgejo` matches a `Host` definition in `~/.ssh/config`.
2. Resolves the real network endpoint to `git.company.internal` on port `2222`.
3. Constructs web URLs targeting `https://git.company.internal/organization/microservice`.
4. Executes background commands using `GIT_SSH_COMMAND` in batch mode without blocking the editor.

---

## Model Context Protocol (MCP) Setup

CommitFlow embeds a complete Model Context Protocol (MCP) server that provides AI agents with tools, real-time repository resources, and structured prompts.

### Server Executable Configuration

To connect external tools such as Claude Desktop, add CommitFlow to your client configuration file.

#### Claude Desktop Configuration (`claude_desktop_config.json`)

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "commitflow": {
      "command": "node",
      "args": [
        "C:/Users/<Username>/.vscode/extensions/ignaciobrenas.commitflow-0.4.5/dist/mcp.js",
        "--repo",
        "C:/Path/To/Your/Repository"
      ]
    }
  }
}
```

### MCP Tools Reference

| Tool Name | Parameters | Description |
| :--- | :--- | :--- |
| `get_my_assigned_issues` | `state?: 'open' \| 'closed'`, `labels?: string[]` | Returns all issues assigned to the developer from Forgejo, GitHub, or GitLab. |
| `get_issue_context` | `issueNumber: number` | Retrieves issue conversation, comments, referencing commits, and pull requests. |
| `start_work_on_issue` | `issueNumber: number`, `useWorktree?: boolean` | Provisions a standardized branch or parallel Git worktree linked to the issue. |
| `analyze_staged_changes` | `includeIssueRef?: number` | Inspects staged diffs and formulates a Conventional Commit message referencing the issue. |
| `search_commit_history` | `query: string`, `author?: string`, `file?: string` | Searches commit graph and historical diffs for specific changes or keywords. |
| `get_pr_triage_status` | `filter?: 'blocked' \| 'ready' \| 'mine' \| 'all'` | Returns pull request triage metrics, CI/CD statuses, and reviewer blocks. |
| `predict_merge_conflicts` | `sourceBranch: string`, `targetBranch: string` | Simulates `git merge-tree` in memory to report exact conflicting files and lines. |
| `compare_revisions` | `baseHash: string`, `targetHash: string` | Compares two arbitrary commits, reporting file diffs, additions, deletions, and commits between. |
| `restore_lost_commit` | `commitHash: string`, `branchName: string` | Restores an orphaned reflog commit onto a newly created branch. |
| `analyze_repo_health` | _None_ | Performs storage diagnostics, calculating loose objects, packfiles, disk size, and dangling commits. |
| `git_bisect_operation` | `action: 'start' \| 'step' \| 'reset' \| 'status'`, `badCommit?: string`, `goodCommit?: string`, `step?: 'good' \| 'bad' \| 'skip'` | Controls Git Bisect binary search sessions, advances probes, and detects regression culprits. |
| `preview_cherry_pick` | `commitHash: string` | Simulates an in-memory three-way merge to forecast cherry-pick conflicts before application. |
| `read_offline_repo_state` | _None_ | Direct filesystem snapshot of the `.git` directory without executing external processes. |
| `commitflow_get_user_impact` | _None_ | Analyzes author impact, total commits, and branch participation metrics. |
| `commitflow_get_line_blame` | `filePath: string`, `line: number` | Returns precise authorship, date, and commit SHA for a specific file line. |
| `commitflow_get_repo_summary` | _None_ | Returns aggregate statistics (commits, branches, contributors, stash count). |

### MCP Dynamic Resources

| Resource URI | MIME Type | Description |
| :--- | :--- | :--- |
| `commitflow://repo/status` | `application/json` | Current branch, remote configuration, active worktrees, and provider type. |
| `commitflow://repo/offline-status` | `application/json` | Raw `.git` filesystem snapshot (HEAD, packed-refs, reflog, active operations). |
| `commitflow://reflog/recent` | `application/json` | Recent chronological reflog entries parsed from disk or git client. |
| `commitflow://repo/health` | `application/json` | Repository health diagnostics (disk size, loose objects, packfiles, dangling commits). |
| `commitflow://bisect/status` | `application/json` | Current Git Bisect state, current probe revision, bad commit, and good boundaries. |
| `commitflow://issues/assigned` | `application/json` | Live feed of issues currently assigned to the active user. |
| `commitflow://branch/current/diff` | `text/x-diff` | Full diff between the current branch and its base tracking branch. |
| `commitflow://repo/user-context` | `text/markdown` | Formatted summary of author contributions and repository impact. |
| `commitflow://repo/graph-summary` | `text/markdown` | High-level summary of recent commit activity and active branches. |

### MCP Structured Prompts

- `triage-issue`: Guides an agent to read an issue description, comments, and referencing code to formulate an implementation plan.
- `review-staged-changes`: Directs an agent to inspect the current index diff and draft a compliant commit message.

---

## Keyboard Shortcuts and Command Reference

All CommitFlow actions can be executed via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) or mapped to custom keybindings in `keybindings.json`.

| Command Identifier | Title | Default Shortcut |
| :--- | :--- | :--- |
| `commitflow.openGraph` | CommitFlow: Open Graph View | `Ctrl+Alt+G` (`Cmd+Option+G`) |
| `commitflow.openInBottomPanel` | CommitFlow: Open CommitFlow Hub in Bottom Panel | -- |
| `commitflow.openIssues` | CommitFlow: Open Issues Tracker Hub | -- |
| `commitflow.openInFork` | CommitFlow: Open Repository in Fork Client | -- |
| `commitflow.refresh` | CommitFlow: Refresh Repository Data | `Alt+R` |
| `commitflow.undoLastCommit` | CommitFlow: Undo Last Commit (Soft Reset) | -- |
| `commitflow.copyChangelog` | CommitFlow: Export Markdown Changelog to Clipboard | -- |
| `commitflow.toggleBlame` | CommitFlow: Toggle Inline Blame Annotations | `Ctrl+Alt+B` (`Cmd+Option+B`) |
| `commitflow.switchTheme` | CommitFlow: Select Color Theme | -- |
| `commitflow.switchLayout` | CommitFlow: Select Layout Placement | -- |

---

## Offline Architecture and Direct .git Inspection

CommitFlow is designed to operate seamlessly in air-gapped environments, on airplanes, during network outages, or inside constrained containers where external network access is unavailable.

### Filesystem Traversal Structure

```text
.git/
├── HEAD                  -> Resolved to determine symbolic branch or detached commit
├── config                -> Parsed for remotes, branch upstreams, and user identity
├── packed-refs           -> Parsed for packed branches, remote tracking refs, and tags
├── refs/
│   ├── heads/            -> Recursive filesystem traversal for local branch heads
│   ├── tags/             -> Recursive traversal for loose tag pointers
│   └── remotes/          -> Recursive traversal for remote tracking branches
├── logs/
│   ├── HEAD              -> Parsed for chronological reflog history (SHAs, authors, dates)
│   └── refs/stash        -> Parsed for complete stash stack history
├── MERGE_HEAD            -> Detected to signal active merge conflict state
├── CHERRY_PICK_HEAD      -> Detected to signal active cherry-pick operation
├── REVERT_HEAD           -> Detected to signal active commit reversal
├── rebase-merge/         -> Parsed for rebase head-name, onto SHA, step, and total steps
├── worktrees/            -> Traversed to discover linked worktree paths and HEAD pointers
└── COMMIT_EDITMSG        -> Read to retrieve the last or draft commit message
```

When offline:
1. All commit graph rendering, branch tracking, and blame operations run entirely against local disk data.
2. The Issue Tracker Hub serves cached issues and comments from the local `LruCache` and persistence store.
3. The Webview header displays a neutral `Direct .git (Offline)` badge indicating that local data is being utilized.

---

## Developer Workflow Operations

### 1. Reverting Commits
Right-click any commit in the graph and select **Revert Commit**. CommitFlow validates the working directory state, executes a clean reversal commit, and updates the DAG view.

### 2. Cherry-Picking
Hover over any commit row or open the inspector drawer, then click **Cherry-Pick**. The commit is applied directly onto your currently checked-out branch.

### 3. Release Tagging
Click the tag icon on any commit row to open the tagging dialog. Choose between a lightweight tag or an annotated tag with custom release notes.

### 4. Soft Undoing Commits
Accidentally committed with the wrong message or forgotten files? Click **Undo Last Commit** in the toolbar. CommitFlow executes `git reset --soft HEAD~1`, returning your changes to the staged index without modifying your working tree files.

### 5. Markdown Changelog Export
Select a range of commits or open the toolbar menu and click **Export Changelog**. A formatted Markdown document grouped by Conventional Commit types (`feat`, `fix`, `docs`, `refactor`) is copied directly to your clipboard.

---

## Troubleshooting and FAQ

### 1. SSH Prompts Hang During Background Fetching
Ensure your remote URL is properly configured. CommitFlow automatically passes `-o BatchMode=yes` to prevent background processes from blocking on terminal passphrase prompts. If your private key requires a passphrase, ensure your operating system's SSH agent is running and has your key loaded (`ssh-add -l`).

### 2. Forgejo Instance Returns HTTP 401 Unauthorized
Verify that your Personal Access Token was configured using `CommitFlow: Configure Remote Access Token` with the exact hostname matching your Git remote (including custom port numbers if applicable, for example `git.myhost.com:2222`).

### 3. Fork Client Does Not Open
Ensure that Fork is installed in the default location:
- Windows: `%LOCALAPPDATA%\Fork\Fork.exe`
- macOS: `/Applications/Fork.app`
- Linux: `fork` executable available in `$PATH`

If Fork is installed in a non-standard path, verify that the `fork://open` URI handler is registered with your operating system.

---

## Building from Source

### Prerequisites

- Node.js version 18.0.0 or higher.
- npm version 9.0.0 or higher.
- Git version 2.23.0 or higher.

### Build Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/Ignaciobrenas/CommitFlow.git
   cd CommitFlow
   ```
2. Install project dependencies:
   ```bash
   npm install
   ```
3. Run the automated test suite (33 suites covering all core subsystems):
   ```bash
   npm test
   ```
4. Build production bundles:
   ```bash
   npm run build
   ```
5. Package the extension into a `.vsix` file:
   ```bash
   npx vsce package
   ```

---

## Security, Privacy, and Telemetry

- **Zero External Telemetry:** CommitFlow does not collect, record, or transmit usage metrics, telemetry, or user analytics to any external third-party servers.
- **Local Execution:** All Git operations, diff computations, and filesystem inspections execute entirely on the local machine.
- **Secure Credential Storage:** Authentication tokens for GitHub, GitLab, and Forgejo/Gitea are stored exclusively within Visual Studio Code's secure `SecretStorage` system, backed by operating system credential managers (Windows Credential Manager, macOS Keychain, or Linux Secret Service).

---

## License

CommitFlow is open-source software licensed under the [MIT License](LICENSE).
Copyright (c) 2026 Ignacio Breñas. All rights reserved.
