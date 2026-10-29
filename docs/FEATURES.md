# CommitFlow Feature Documentation and Manual

This document provides a comprehensive operational manual and technical specification for all features included in CommitFlow.

---

## 1. Topological Commit Graph

### 1.1 Multi-Lane Continuous DAG Engine
- **Topological Sorting:** Automatically sorts Git commits into a directed acyclic graph, assigning each branch to a distinct visual vertical lane.
- **Retina Bézier Curves:** Renders junction points, fork splits, and merge consolidations using cubic Bézier curves (`M x1 y1 C cx1 cy1 cx2 cy2 x2 y2`).
- **Retina Display Scaling:** Automatically scales the rendering canvas to match `window.devicePixelRatio`, preventing blurry visuals on 4K, 5K, and Retina screens.

### 1.2 Layout Adaptability
- **Bottom Panel Mode:** Wide horizontal split screen layout. Places the commit graph canvas on the left and the commit inspector/details pane on the right.
- **Left Sidebar Mode:** Classical vertical sidebar mode. Inspector and action panels slide out to the right.
- **Right Sidebar Mode:** Mirrored drawer architecture. Side panels slide inwards to the left, preventing off-screen clipping on narrow displays.
- **Auto Responsive Mode:** Uses a `ResizeObserver` listener on the container element to switch dynamically between wide and narrow layout configurations.

### 1.3 Instant Search and Filter Matrix
- Real-time search input filtering commits across multiple criteria:
  - Commit message subject and full body.
  - Author name and email address.
  - Commit SHA-1 full hash or short hash prefix.
  - Branch reference or tag name.

---

## 2. Direct .git Filesystem Offline Engine

### 2.1 Pure Filesystem Execution
- Directly parses the `.git` directory structure without invoking external binaries or spawning child processes.
- Runs in air-gapped environments, sandboxed remote containers, and minimal Linux environments without Git installed.

### 2.2 Inspected Data Elements
- **References:** Reads `.git/HEAD`, `.git/refs/heads/*`, `.git/refs/tags/*`, and `.git/refs/remotes/*`.
- **Packed References:** Reads `.git/packed-refs` including peeled tag references (`^{}`).
- **Local Reflog History:** Extracts chronological commit trail from `.git/logs/HEAD`.
- **Stashes:** Extracts local stash entries from `.git/logs/refs/stash`.
- **Active Git Operations:**
  - Detects active merges via `.git/MERGE_HEAD`.
  - Detects active cherry-picks via `.git/CHERRY_PICK_HEAD`.
  - Detects active reverts via `.git/REVERT_HEAD`.
  - Detects rebases via `.git/rebase-merge` or `.git/rebase-apply`.
- **Worktrees:** Enumerates linked worktrees from `.git/worktrees/*`.

---

## 3. Unified Hosting Providers: Forgejo, Gitea, GitHub, GitLab

### 3.1 Forgejo and Gitea Native API v1 Support
- Direct communication with Forgejo / Gitea API v1 endpoints (`/api/v1`).
- Auto-detection: Identifies instances using host heuristics or silent `/api/v1/version` validation.
- Personal Access Token management: Encrypted storage in VS Code `SecretStorage` (`commitflow.token.forgejo.<host>`).
- Operations:
  - Fetches repository metadata, stars, forks, and permissions.
  - Fetches, creates, and updates issues, comments, and labels.
  - Fetches commit status checks (CI/CD pipelines).
  - Manages pull requests and checks mergeability.
- Offline Caching: All remote records are stored in an in-memory `LruCache` to remain available when the connection is severed.

### 3.2 GitHub and GitLab Integration
- Seamless VS Code authentication session integration.
- Private repository detection with dedicated status badges: `GitHub Private`, `GitLab Private`, `Forgejo Private`.

---

## 4. Universal OpenSSH Configuration Parser

### 4.1 URL Normalization
- Supports SCP syntax: `git@host:owner/repo.git`.
- Supports SSH with custom port: `ssh://git@host:2222/owner/repo.git`.
- Supports HTTPS and HTTP URLs: `https://host/owner/repo.git`.

### 4.2 ~/.ssh/config Alias Resolution
- Parses `~/.ssh/config` (or a configured custom path).
- Maps host aliases to actual network endpoints:
  - `HostName`
  - `Port`
  - `User`
  - `IdentityFile`

### 4.3 Non-Blocking Execution
- Injects `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"`.
- Prevents background fetchers from hanging on interactive host key prompts.
- Preserves and forwards `SSH_AUTH_SOCK` for active SSH agent sessions.

---

## 5. Fork Desktop Client Interoperability

- Automatically locates the Fork executable:
  - Windows: `%LOCALAPPDATA%\Fork\Fork.exe`
  - macOS: `/Applications/Fork.app`
  - Linux: `fork` binary in `$PATH`
- Inspects shared rebase/merge states between CommitFlow and Fork.
- Provides a one-click toolbar button and command (`CommitFlow: Open Repository in Fork Client`) to launch Fork targeting the active repository.

---

## 6. Issue Tracker Hub & Issue-to-Code Workflow

### 6.1 Issue Views
- **Assigned to Me:** Displays open issues assigned to the active user across Forgejo, GitHub, and GitLab.
- **Associated to Branch / Commits:** Automatically links issues detected in branch names (`feat/issue-42-login`) or local unpushed commit messages (`Closes #42`).
- **All Issues / Label Filters:** Real-time search and filtering by title, body, author, and label pills.

### 6.2 1-Click Issue Actions
- **Create Branch / Worktree:** Generates standardized branch names using customizable templates (`feat/{id}-{slug}`) or creates a parallel Git worktree.
- **Insert Commit Reference:** Copies or injects `Closes #<id>` into the commit preparation buffer.
- **Inspector Drawer:** Displays Markdown-rendered issue descriptions, team comment threads, status toggles (open/closed), and comment creation forms.
- **Interactive Blame & Graph Hover:** Hovering over `#<id>` in commit messages or file blame lines displays a preview card with issue details and status.

---

## 7. Pull Request & Merge Request Triage

- Triages active pull requests into four distinct status categories:
  - **Blocked:** Failing CI checks or reviewer change requests.
  - **Ready:** Approved by reviewers with passing CI checks.
  - **Pending:** Awaiting initial reviews.
  - **Mine:** Authored by the active user.
- Actions: One-click local checkout of PR head branch, direct browser navigation, and clipboard URL copying.

---

## 8. Git Worktrees & Multi-WIP Tracking

- Develop on multiple branches concurrently in isolated directories without switching branches or stashing work.
- Real-time dirty state detection: Displays whether each worktree has uncommitted modifications (`WIP Active: N files`) or is clean.
- Lifecycle management: Add new worktrees, open worktrees in separate VS Code windows, and prune obsolete worktrees.

---

## 9. Visual File History & Line Delta Tracking

- Dedicated visual lifecycle timeline for any file in the workspace or the currently active editor tab.
- Line delta metrics: Visual pills indicating additions and deletions (`+24 -8`) per commit revision.
- One-click native comparative diff viewer against parent revisions or current working tree.

---

## 10. Cloud Patches (Zero-Push Collaboration)

- Share uncommitted changes or branch diffs with colleagues privately without pushing WIP commits to remote branches.
- Self-contained unified diff bundles created with one click.
- Dry-run validation (`git apply --check`) prevents merge conflicts before applying patches.

---

## 11. Inline Blame & Author Analytics

- Non-intrusive inline ghost text displayed at the end of the active cursor line.
- Status bar integration showing commit author, relative timestamp, and commit SHA.
- Personal contribution analytics: Calculates total commits, participation percentages across branches, and author rankings.

---

## 12. Model Context Protocol (MCP) Server

- Built-in JSON-RPC 2.0 server operating over stdio (`CommitFlowMcpServer`).
- Exposes tools for external AI agents:
  - `get_my_assigned_issues`
  - `get_issue_context`
  - `start_work_on_issue`
  - `analyze_staged_changes`
  - `search_commit_history`
  - `get_pr_triage_status`
  - `predict_merge_conflicts`
  - `read_offline_repo_state`
- Dynamic resources:
  - `commitflow://repo/status`
  - `commitflow://repo/offline-status`
  - `commitflow://issues/assigned`
  - `commitflow://branch/current/diff`
- Agent prompts:
  - `triage-issue`
  - `review-staged-changes`

---

## 13. Professional Developer Tooling

- **Cherry-Pick:** 1-click cherry-pick from any commit row directly into the current branch.
- **Revert Commit:** Safe, clean commit reversal with instant verification.
- **Git Tagging:** Create annotated or lightweight release tags on any commit node.
- **Markdown Changelog:** Generates formatted release changelogs grouped by Conventional Commit types.
- **Undo Last Commit:** Roll back accidental commits safely via `git reset --soft HEAD~1`.

---

## 14. Adaptive Layouts & Professional Color Themes

- Instant live theme switching without window reload:
  - **Cyberpunk:** Neon yellow and deep purple with magenta accents.
  - **Dracula:** Official Dracula palette.
  - **GitHub Dark:** Authentic GitHub code review dark theme.
  - **Neon Pink:** Synthwave glowing pink and turquoise.
  - **Neon Green:** Terminal emerald glowing green.
  - **Neon Blue:** Electric cybernetic blue.
  - **Clean Light:** High-contrast light theme for bright environments.
  - **Auto:** Dynamically inherits VS Code active theme.
