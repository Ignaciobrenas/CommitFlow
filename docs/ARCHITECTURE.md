# CommitFlow Architecture Specification

## 1. System Overview

CommitFlow is a high-performance Visual Studio Code extension designed for enterprise Git visualization, direct local filesystem inspection, multi-platform hosting integration, and Model Context Protocol (MCP) artificial intelligence connectivity.

The architecture emphasizes:
- **Zero-Latency Execution:** Instantaneous local DAG generation, LRU caching of blames and issues, and debounced file watcher subscriptions.
- **Air-Gapped Offline Resilience:** Pure filesystem inspection of `.git` objects, packed references, and reflogs without external process dependencies.
- **Polymorphic Remote Abstraction:** Uniform interface across Forgejo/Gitea, GitHub, GitLab, and Bitbucket.
- **Strict Process & Sandbox Security:** Non-blocking SSH execution, strict Content Security Policy (CSP), HTML escaping, and path traversal containment.

---

## 2. Component Topology

```text
+-----------------------------------------------------------------------------------------------+
|                                  VS CODE EXTENSION HOST                                       |
|                                                                                               |
|  +------------------------+      +-------------------------+      +------------------------+  |
|  |     extension.ts       |      | PersistenceManager      |      | AvatarService          |  |
|  | (Lifecycle & Commands) |      | (SecretStorage & Conf)  |      | (Gravatar/SVG/Cache)   |  |
|  +-----------+------------+      +------------+------------+      +-----------+------------+  |
|              |                                |                               |               |
|              +--------------------------------+-------------------------------+               |
|                                               |                                               |
|  +--------------------------------------------v--------------------------------------------+  |
|  |                              GraphWebviewProvider                                       |  |
|  |                  (CSP nonce generation, Tab router, IPC Dispatcher)                     |  |
|  +--------------------------------------------+--------------------------------------------+  |
|                                               |                                               |
|         +-------------------------------------+-------------------------------------+         |
|         |                                     |                                     |         |
|         v                                     v                                     v         |
|  +---------------+                 +--------------------+                 +----------------+  |
|  |   GitClient   |                 |   RemoteManager    |                 |  IssueService  |  |
|  +-------+-------+                 +----------+---------+                 +--------+-------+  |
|          |                                    |                                    |          |
|  +-------v-------+                 +----------v---------+                 +--------v-------+  |
|  |  GitFsReader  |                 |  ForgejoProvider   |                 | BranchLinker   |  |
|  | (Direct .git) |                 |  GitHubProvider    |                 | (Regex Engine) |  |
|  +---------------+                 |  GitLabProvider    |                 +----------------+  |
|                                    |  SshConfigParser   |                                     |
|                                    |  ForkIntegration   |                                     |
|                                    +--------------------+                                     |
+-----------------------------------------------------------------------------------------------+
                                                ^
                                                | Stdio / JSON-RPC 2.0
+-----------------------------------------------v-----------------------------------------------+
|                                COMMITFLOW MCP SERVER                                          |
|                               (commitflowMcpServer.ts)                                        |
|                                                                                               |
|    - Tools: get_my_assigned_issues, predict_merge_conflicts, analyze_staged_changes, etc.     |
|    - Resources: commitflow://repo/status, commitflow://repo/offline-status, etc.              |
|    - Prompts: triage-issue, review-staged-changes                                             |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Subsystem Breakdown

### 3.1 Git Execution & Filesystem Subsystem (`src/git/`)

1. **`GitClient`:**
   - Spawns `git` binary using argument arrays (no shell interpreter).
   - Injects non-blocking environment: `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C.UTF-8`, `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new"`.
   - Propagates system SSH authentication socket (`SSH_AUTH_SOCK`).
   - Implements in-memory merge conflict prediction via `git merge-tree`.
   - Implements multi-commit revision comparison via `git diff --numstat <base>..<target>`.
   - Extracts chronological reflog entries via `git reflog` with pure disk fallback to `.git/logs/HEAD`.
   - Restores orphaned or lost commits onto new branches via `restoreReflogCommit`.
   - Computes repository storage health metrics (`getRepoHealth`) and executes maintenance garbage collection (`runRepoGc`).

2. **`GitFsReader` (Offline Direct Reader):**
   - Pure Node.js filesystem implementation targeting `.git`.
   - Recursively reads loose references (`refs/heads/`, `refs/tags/`, `refs/remotes/`).
   - Parses `.git/packed-refs` with support for peeled annotated tags (`^{}`).
   - Parses `.git/logs/HEAD` for chronological reflog entries without executing subprocesses.
   - Inspects in-flight operation state files: `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `worktrees/`.
   - Enforces path containment to prevent directory traversal outside `repoRoot`.

3. **`GitParser`:**
   - High-throughput streaming parser for `git log` output using null-byte and custom delimiter tokens.
   - Extracts commit hashes, tree hashes, parent references, author timestamps, author names, emails, and commit subjects.
   - Parses GPG and OpenSSH cryptographic signature indicators: `%G?` (status), `%GS` (signer identity), and `%GK` (key fingerprint).

---

### 3.2 Remote & Hosting Provider Subsystem (`src/remotes/`)

1. **`RemoteManager`:**
   - Singleton coordinator that inspects repository remote URLs.
   - Matches URLs to appropriate `RemoteProvider` implementations.
   - Generates contextual security badges (`Forgejo Private`, `GitHub Private`, `GitLab Private`).

2. **`ForgejoProvider`:**
   - Implements Forgejo and Gitea API v1 (`/api/v1`).
   - Authenticates requests via `Authorization: token <PAT>` using VS Code `SecretStorage`.
   - Features local `LruCache` storage for issues, comments, pull requests, labels, and milestones, providing offline resilience.
   - Utilizes `safeFetch` with a strict 4000ms timeout controller to prevent unresponsive network requests.

3. **`SshConfigParser`:**
   - Parses OpenSSH client configuration (`~/.ssh/config`).
   - Resolves aliases (e.g. `Host my-box` -> `HostName 10.0.0.1`, `Port 2222`, `User git`).
   - Supports SCP syntax (`git@host:repo.git`) and URL syntax (`ssh://git@host:port/repo.git`).

4. **`ForkIntegration`:**
   - Detects local installation of the Fork desktop Git client.
   - Inspects shared repository operation states (`.git/rebase-merge`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`).
   - Bridges repository context to Fork via executable launch or `fork://open` protocol handler.

---

### 3.3 Issue Tracker Hub Subsystem (`src/issues/`)

1. **`IssueService`:**
   - Aggregates issues assigned to the active user across Forgejo, GitHub, and GitLab.
   - Links issues to branches and unpushed commits.
   - Provisions branches and parallel Git worktrees from issue records.

2. **`IssueBranchLinker`:**
   - Regular expression pattern matcher identifying issue IDs in branch names:
     - `feat/issue-42-title`
     - `fix/#108-login`
     - `42-description`
   - Scans unpushed commit messages for keywords: `Closes #<id>`, `Fixes #<id>`, `Refs #<id>`.
   - Generates URL-safe slugs and standardized branch names using customizable templates (`feat/{id}-{slug}`).

---

### 3.4 Model Context Protocol Subsystem (`src/mcp/`)

1. **`CommitFlowMcpServer`:**
   - Implements JSON-RPC 2.0 protocol over standard input/output (stdio).
   - Exposes tools for issue triage, conflict prediction, staged change analysis, commit searching, revision comparison, lost-commit recovery, repository health analysis, and offline repository inspection.
   - Serves dynamic real-time resources (`commitflow://repo/status`, `commitflow://repo/offline-status`, `commitflow://reflog/recent`, `commitflow://repo/health`, `commitflow://issues/assigned`, `commitflow://branch/current/diff`).
   - Enforces path containment checks preventing agents from accessing files outside the repository root.

---

### 3.5 Webview & Presentation Subsystem (`src/webview/`, `src/graph/`)

1. **Content Security Policy (CSP):**
   - Directives: `default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:;`.
   - Blocks external scripts and network requests from inside the webview.
   - Communicates exclusively via asynchronous `vscode.postMessage` IPC messages.

2. **Topological Lane Allocator (`GraphLayout`):**
   - Computes cubic Bézier paths for branch tracks.
   - Assigns lane indices to prevent visual crossings.
   - Harmonizes lane colors dynamically across color themes (Cyberpunk, Dracula, GitHub Dark, Neon variants, Clean Light).

3. **Data Sanitization:**
   - All text rendered into HTML elements passes through `escapeHtml()` to eliminate Stored Cross-Site Scripting (XSS) risks.
