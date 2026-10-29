import * as readline from 'readline';
import * as path from 'path';
import { GitClient } from '../git/gitClient';
import { IssueService } from '../issues/issueService';
import { RemoteManager } from '../remotes/remoteManager';

export class CommitFlowMcpServer {
  private readonly gitClient = GitClient.getInstance();
  private readonly issueService = IssueService.getInstance();
  private readonly remoteManager = RemoteManager.getInstance();
  private repoRoot: string;

  constructor(targetDir?: string) {
    this.repoRoot = targetDir ? path.resolve(targetDir) : process.cwd();
  }

  public async start(): Promise<void> {
    // Resolve git root
    const resolvedRoot = await this.gitClient.getRepoRoot(this.repoRoot);
    if (resolvedRoot) {
      this.repoRoot = resolvedRoot;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const request = JSON.parse(trimmed);
        const response = await this.handleJsonRpc(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (err: any) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${err.message || String(err)}`,
          },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    process.stderr.write(`⚡ [CommitFlow MCP] Server listening on stdio (Repo: ${this.repoRoot})\n`);
  }

  private async handleJsonRpc(req: any): Promise<any> {
    const { id, method, params } = req;

    // Notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        return null;
      }
      return null;
    }

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'commitflow-mcp',
              version: '0.4.5',
            },
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              // 1. get_my_assigned_issues
              {
                name: 'get_my_assigned_issues',
                description:
                  'Retrieve open or closed issues assigned to the developer in Forgejo, GitHub, or GitLab, including body and comments.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    state: {
                      type: 'string',
                      enum: ['open', 'closed', 'all'],
                      description: 'Filter issues by state (default: open)',
                    },
                    labels: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Optional label filters',
                    },
                  },
                },
              },
              // 2. get_issue_context
              {
                name: 'get_issue_context',
                description:
                  'Get deep issue context: full issue conversation, labels, author, milestone, and Git commits/PRs referencing #issueNumber.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    issueNumber: {
                      type: 'number',
                      description: 'The issue number / ID to inspect',
                    },
                  },
                  required: ['issueNumber'],
                },
              },
              // 3. start_work_on_issue
              {
                name: 'start_work_on_issue',
                description:
                  'Creates a standardized Git branch (e.g. feat/42-slug) or dedicated parallel worktree linked to an issue and checks it out.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    issueNumber: {
                      type: 'number',
                      description: 'The issue number to work on',
                    },
                    useWorktree: {
                      type: 'boolean',
                      description: 'If true, creates a parallel Git worktree instead of in-place branch checkout',
                    },
                  },
                  required: ['issueNumber'],
                },
              },
              // 4. analyze_staged_changes
              {
                name: 'analyze_staged_changes',
                description:
                  'Analyze git diff --staged to craft a high-quality Conventional Commit message, optionally referencing an issue.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    includeIssueRef: {
                      type: 'number',
                      description: 'Optional issue number to append (e.g. Closes #42)',
                    },
                  },
                },
              },
              // 5. search_commit_history
              {
                name: 'search_commit_history',
                description:
                  'Ultra-fast search in commit graph and file evolution: answer questions like "When and why did this change?".',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Search string matching commit subject, body, or hash',
                    },
                    author: {
                      type: 'string',
                      description: 'Optional author name or email',
                    },
                    file: {
                      type: 'string',
                      description: 'Optional file path filter',
                    },
                  },
                  required: ['query'],
                },
              },
              // 6. get_pr_triage_status
              {
                name: 'get_pr_triage_status',
                description:
                  'Returns active Pull Requests / Merge Requests with CI/CD status, review decisions, and conflict status.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    filter: {
                      type: 'string',
                      enum: ['blocked', 'ready', 'mine', 'all'],
                      description: 'Filter PRs by triage category (blocked, ready, mine, all)',
                    },
                  },
                },
              },
              // 7. predict_merge_conflicts
              {
                name: 'predict_merge_conflicts',
                description:
                  'Runs in-memory git merge-tree before merging to predict exact colliding files and line conflicts.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    sourceBranch: {
                      type: 'string',
                      description: 'Source branch to merge from',
                    },
                    targetBranch: {
                      type: 'string',
                      description: 'Target branch to merge into',
                    },
                  },
                  required: ['sourceBranch', 'targetBranch'],
                },
              },
              // Existing Legacy / Direct Tools
              {
                name: 'commitflow_get_user_impact',
                description:
                  'Get complete context of what the user/developer has done in this repository: total commits, repo authorship share, and branch participation.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'commitflow_get_active_context',
                description:
                  'Get the active Git branch context: current branch name, detached HEAD status, upstream status, stashes, and uncommitted changes.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'commitflow_get_commit_history',
                description:
                  'Get the topological commit graph history with branch pointers, tags, author metadata, and parent links.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    limit: {
                      type: 'number',
                      description: 'Maximum number of commits to retrieve (default: 30)',
                    },
                  },
                },
              },
              {
                name: 'commitflow_get_line_blame',
                description:
                  'Get deep Git authorship blame for a specific line in a file.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    filePath: {
                      type: 'string',
                      description: 'Relative or absolute file path',
                    },
                    line: {
                      type: 'number',
                      description: 'Line number (1-based)',
                    },
                  },
                  required: ['filePath', 'line'],
                },
              },
              {
                name: 'read_offline_repo_state',
                description:
                  'Read repository state directly from the local .git directory (HEAD, branches, tags, remotes, stashes, worktrees, reflog, and active merge/rebase operations). Works 100% offline with zero process and zero network dependencies.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'compare_revisions',
                description:
                  'Compare any two commits or revisions, computing cumulative diff stats, additions/deletions per file, and commits between.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    baseHash: { type: 'string', description: 'Base commit SHA or branch name' },
                    targetHash: { type: 'string', description: 'Target commit SHA or branch name' },
                  },
                  required: ['baseHash', 'targetHash'],
                },
              },
              {
                name: 'restore_lost_commit',
                description:
                  'Recover a lost or dangling commit from reflog by creating a new recovery branch at that commit SHA.',
                inputSchema: {
                  type: 'object',
                  properties: {
                    commitHash: { type: 'string', description: 'Commit SHA to restore' },
                    branchName: { type: 'string', description: 'Name of the branch to create' },
                  },
                  required: ['commitHash', 'branchName'],
                },
              },
              {
                name: 'analyze_repo_health',
                description:
                  'Inspect repository storage health: disk footprint of .git/objects, loose objects, packfile count, and dangling commits.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'commitflow_get_repo_summary',
                description:
                  'Get high-level repository analytics: total commits, active branches, total contributors, stash count, and top author rankings.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
            ],
          },
        };

      case 'tools/call':
        return await this.handleToolCall(id, params?.name, params?.arguments);

      case 'resources/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: 'commitflow://repo/status',
                name: 'Repository Status & Remote Architecture',
                description:
                  'Current branch, remote SSH/HTTPS configuration, provider type (Forgejo/GitHub/GitLab), and active worktrees.',
                mimeType: 'application/json',
              },
              {
                uri: 'commitflow://repo/offline-status',
                name: 'Direct .git Offline Snapshot',
                description:
                  'Raw .git filesystem inspection including packed-refs, HEAD, remotes, reflog, and in-flight operations without Git CLI.',
                mimeType: 'application/json',
              },
              {
                uri: 'commitflow://issues/assigned',
                name: 'Assigned Issues Feed',
                description: 'Live JSON of issues assigned to the developer in the current repository.',
                mimeType: 'application/json',
              },
              {
                uri: 'commitflow://branch/current/diff',
                name: 'Current Branch Cumulative Diff',
                description: 'Full diff between current branch and upstream/base branch.',
                mimeType: 'text/x-diff',
              },
              {
                uri: 'commitflow://repo/user-context',
                name: 'User Repository Activity Profile',
                description: 'Markdown formatted summary of user contributions and impact.',
                mimeType: 'text/markdown',
              },
              {
                uri: 'commitflow://repo/graph-summary',
                name: 'Git Branch & Commit Overview',
                description: 'Overview of recent commits and active branches.',
                mimeType: 'text/markdown',
              },
              {
                uri: 'commitflow://reflog/recent',
                name: 'Recent Reflog Timeline',
                description: 'Stream of recent HEAD reflog transitions and operations.',
                mimeType: 'application/json',
              },
              {
                uri: 'commitflow://repo/health',
                name: 'Repository Storage Health & GC Status',
                description: 'Detailed object metrics, packfile counts, and dangling commit counts.',
                mimeType: 'application/json',
              },
            ],
          },
        };

      case 'resources/read':
        return await this.handleResourceRead(id, params?.uri);

      case 'prompts/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            prompts: [
              {
                name: 'triage-issue',
                description: 'Analyze an issue, review discussions, and design an implementation plan.',
                arguments: [
                  {
                    name: 'issueNumber',
                    description: 'Issue number to analyze',
                    required: true,
                  },
                ],
              },
              {
                name: 'review-staged-changes',
                description: 'Inspect staged changes and draft a Conventional Commit message.',
                arguments: [
                  {
                    name: 'issueNumber',
                    description: 'Optional issue number to reference',
                    required: false,
                  },
                ],
              },
            ],
          },
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
    }
  }

  private async handleToolCall(id: any, name: string, args: any = {}): Promise<any> {
    try {
      let resultData: any;

      switch (name) {
        // --- 1. get_my_assigned_issues ---
        case 'get_my_assigned_issues':
        case 'commitflow_get_my_assigned_issues': {
          let issues = await this.issueService.getAssignedIssues(this.repoRoot);
          if (args.state && args.state !== 'all') {
            issues = issues.filter((i) => i.state === args.state);
          }
          if (args.labels && Array.isArray(args.labels) && args.labels.length > 0) {
            const reqLabels = (args.labels as string[]).map((l) => l.toLowerCase());
            issues = issues.filter((i) =>
              i.labels.some((l) => reqLabels.includes(l.name.toLowerCase()))
            );
          }
          resultData = issues;
          break;
        }

        // --- 2. get_issue_context ---
        case 'get_issue_context':
        case 'commitflow_get_issue_context': {
          const num = Number(args.issueNumber);
          if (isNaN(num)) throw new Error('issueNumber must be a valid number');
          resultData = await this.issueService.getIssueContext(this.repoRoot, num);
          break;
        }

        // --- 3. start_work_on_issue ---
        case 'start_work_on_issue':
        case 'commitflow_start_work_on_issue': {
          const num = Number(args.issueNumber);
          if (isNaN(num)) throw new Error('issueNumber must be a valid number');
          const useWorktree = Boolean(args.useWorktree);
          resultData = await this.issueService.startWorkOnIssue(this.repoRoot, num, useWorktree);
          break;
        }

        // --- 4. analyze_staged_changes ---
        case 'analyze_staged_changes':
        case 'commitflow_analyze_staged_changes': {
          const issueRef = args.includeIssueRef ? Number(args.includeIssueRef) : undefined;
          resultData = await this.gitClient.analyzeStagedChanges(this.repoRoot, issueRef);
          break;
        }

        // --- 5. search_commit_history ---
        case 'search_commit_history':
        case 'commitflow_search_commit_history': {
          resultData = await this.gitClient.searchCommitHistory(
            this.repoRoot,
            args.query,
            args.author,
            args.file
          );
          break;
        }

        // --- 6. get_pr_triage_status ---
        case 'get_pr_triage_status':
        case 'commitflow_get_pr_triage_status': {
          const prs = await this.gitClient.getPullRequests(this.repoRoot);
          const filter = args.filter || 'all';
          if (filter === 'blocked') {
            resultData = prs.filter((p) => p.isBlocked);
          } else if (filter === 'ready') {
            resultData = prs.filter((p) => p.isReady);
          } else if (filter === 'mine') {
            const user = await this.gitClient.getUserIdentity(this.repoRoot);
            resultData = prs.filter(
              (p) =>
                p.author.name.toLowerCase() === user.name.toLowerCase() ||
                p.author.email.toLowerCase() === user.email.toLowerCase()
            );
          } else {
            resultData = prs;
          }
          break;
        }

        // --- 7. predict_merge_conflicts ---
        case 'predict_merge_conflicts':
        case 'commitflow_predict_merge_conflicts': {
          if (!args.sourceBranch || !args.targetBranch) {
            throw new Error('sourceBranch and targetBranch are required');
          }
          resultData = await this.gitClient.predictMergeConflicts(
            this.repoRoot,
            args.sourceBranch,
            args.targetBranch
          );
          break;
        }

        // --- Legacy Direct Tools ---
        case 'commitflow_get_user_impact': {
          const commits = await this.gitClient.getCommits(this.repoRoot, 200);
          const branches = await this.gitClient.getBranches(this.repoRoot);
          const user = await this.gitClient.getUserIdentity(this.repoRoot);
          resultData = this.gitClient.computePersonalStats(
            commits,
            branches,
            user.name,
            user.email
          );
          break;
        }

        case 'commitflow_get_active_context': {
          const currentBranch = await this.gitClient.getCurrentBranch(this.repoRoot);
          const upstream = await this.gitClient.getUpstreamStatus(this.repoRoot);
          const workingTree = await this.gitClient.getWorkingTreeChanges(this.repoRoot);
          const stashes = await this.gitClient.getStashes(this.repoRoot);
          resultData = {
            repoRoot: this.repoRoot,
            currentBranch,
            upstream,
            stashesCount: stashes.length,
            stashes,
            uncommittedChangesCount: workingTree.length,
            uncommittedFiles: workingTree,
          };
          break;
        }

        case 'commitflow_get_commit_history': {
          const limit = args.limit || 30;
          const commits = await this.gitClient.getCommits(this.repoRoot, limit);
          resultData = commits.map((c) => ({
            hash: c.hash,
            shortHash: c.shortHash,
            subject: c.subject,
            author: c.author.name,
            date: c.author.date,
            relativeTime: c.author.relativeTime,
            refs: c.refs.map((r) => r.name),
            parents: c.parentHashes.map((p) => p.slice(0, 7)),
          }));
          break;
        }

        case 'commitflow_get_line_blame': {
          const resolvedPath = path.resolve(this.repoRoot, args.filePath);
          const normalizedRepo = path.resolve(this.repoRoot);
          if (!resolvedPath.startsWith(normalizedRepo)) {
            throw new Error('Access denied: filePath must reside within repository root.');
          }
          const blame = await this.gitClient.getBlameForLine(resolvedPath, args.line);
          resultData = blame || { message: 'No git blame available for this line.' };
          break;
        }

        case 'commitflow_get_repo_summary': {
          const commits = await this.gitClient.getCommits(this.repoRoot, 500);
          const branches = await this.gitClient.getBranches(this.repoRoot);
          const stashes = await this.gitClient.getStashes(this.repoRoot);
          const stats = this.gitClient.computeRepoStats(commits, branches);
          resultData = {
            ...stats,
            stashCount: stashes.length,
          };
          break;
        }

        case 'read_offline_repo_state':
        case 'commitflow_read_offline_repo_state': {
          resultData = this.gitClient.getOfflineRepoState(this.repoRoot) || {
            isRepo: false,
            message: 'No .git directory found at repository root.',
          };
          break;
        }

        case 'compare_revisions':
        case 'commitflow_compare_revisions': {
          if (!args.baseHash || !args.targetHash) {
            throw new Error('baseHash and targetHash are required');
          }
          resultData = await this.gitClient.compareCommits(
            this.repoRoot,
            args.baseHash,
            args.targetHash
          );
          break;
        }

        case 'restore_lost_commit':
        case 'commitflow_restore_lost_commit': {
          if (!args.commitHash || !args.branchName) {
            throw new Error('commitHash and branchName are required');
          }
          await this.gitClient.restoreReflogCommit(
            this.repoRoot,
            args.commitHash,
            args.branchName
          );
          resultData = {
            success: true,
            message: `Successfully created recovery branch '${args.branchName}' at commit ${args.commitHash}`,
          };
          break;
        }

        case 'analyze_repo_health':
        case 'commitflow_analyze_repo_health': {
          resultData = await this.gitClient.getRepoHealth(this.repoRoot);
          break;
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unknown tool name: ${name}`,
            },
          };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultData, null, 2),
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: `Execution error: ${err.message || String(err)}`,
        },
      };
    }
  }

  private async handleResourceRead(id: any, uri: string): Promise<any> {
    try {
      let contentText = '';
      let mimeType = 'text/plain';

      if (uri === 'commitflow://repo/status') {
        const currentBranch = await this.gitClient.getCurrentBranch(this.repoRoot);
        const remote = await this.gitClient.getRemoteRepoInfo(this.repoRoot);
        const worktrees = await this.gitClient.getWorktrees(this.repoRoot);
        const upstream = await this.gitClient.getUpstreamStatus(this.repoRoot);

        contentText = JSON.stringify(
          {
            repoRoot: this.repoRoot,
            currentBranch,
            remote,
            provider: remote?.provider || 'none',
            worktrees,
            upstream,
          },
          null,
          2
        );
        mimeType = 'application/json';
      } else if (uri === 'commitflow://repo/offline-status') {
        const offlineState = this.gitClient.getOfflineRepoState(this.repoRoot);
        contentText = JSON.stringify(offlineState || { isRepo: false }, null, 2);
        mimeType = 'application/json';
      } else if (uri === 'commitflow://issues/assigned') {
        const issues = await this.issueService.getAssignedIssues(this.repoRoot);
        contentText = JSON.stringify(issues, null, 2);
        mimeType = 'application/json';
      } else if (uri === 'commitflow://branch/current/diff') {
        const currentBranch = await this.gitClient.getCurrentBranch(this.repoRoot);
        // Find base branch
        const branches = await this.gitClient.getBranches(this.repoRoot);
        const baseName = branches.some((b) => b.name === 'main')
          ? 'main'
          : branches.some((b) => b.name === 'master')
          ? 'master'
          : 'HEAD~1';

        try {
          contentText = await this.gitClient.execute(['diff', `${baseName}...${currentBranch}`], this.repoRoot);
        } catch {
          contentText = await this.gitClient.execute(['diff', 'HEAD~1'], this.repoRoot);
        }
        mimeType = 'text/x-diff';
      } else if (uri === 'commitflow://repo/user-context') {
        const commits = await this.gitClient.getCommits(this.repoRoot, 200);
        const branches = await this.gitClient.getBranches(this.repoRoot);
        const user = await this.gitClient.getUserIdentity(this.repoRoot);
        const stats = this.gitClient.computePersonalStats(
          commits,
          branches,
          user.name,
          user.email
        );
        const currentBranch = await this.gitClient.getCurrentBranch(this.repoRoot);

        contentText = `# CommitFlow User Activity Context\n\n` +
          `- **User:** ${stats.userName} (${stats.userEmail || 'No email'})\n` +
          `- **Current Active Branch:** \`${currentBranch}\`\n` +
          `- **Total Commits Authored:** ${stats.myTotalCommits} / ${stats.repoTotalCommits} (${stats.commitPercentage}% of repo)\n` +
          `- **Branches Participated In:** ${stats.participatedBranchesCount}\n\n` +
          `## Branch Contributions\n` +
          stats.branches
            .map(
              (b) =>
                `- **${b.branchName}**${b.isCurrent ? ' (HEAD)' : ''}: ${b.myCommitsCount} commits (${b.percentage}%)`
            )
            .join('\n');
        mimeType = 'text/markdown';
      } else if (uri === 'commitflow://repo/graph-summary') {
        const commits = await this.gitClient.getCommits(this.repoRoot, 15);
        contentText = `# CommitFlow Recent Git Graph\n\n` +
          commits
            .map(
              (c) =>
                `- \`${c.shortHash}\` **${c.subject}** (${c.author.name}, ${c.author.relativeTime}) ${c.refs.map((r) => `[${r.name}]`).join(' ')}`
            )
            .join('\n');
        mimeType = 'text/markdown';
      } else if (uri === 'commitflow://reflog/recent') {
        const reflog = await this.gitClient.getReflog(this.repoRoot, 50);
        contentText = JSON.stringify(reflog, null, 2);
        mimeType = 'application/json';
      } else if (uri === 'commitflow://repo/health') {
        const health = await this.gitClient.getRepoHealth(this.repoRoot);
        contentText = JSON.stringify(health, null, 2);
        mimeType = 'application/json';
      } else {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Resource not found: ${uri}`,
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType,
              text: contentText,
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: `Resource read error: ${err.message || String(err)}`,
        },
      };
    }
  }
}

// Standalone CLI invocation
if (require.main === module) {
  const targetDir = process.argv[2] || process.cwd();
  const server = new CommitFlowMcpServer(targetDir);
  server.start().catch((err) => {
    process.stderr.write(`Fatal MCP Server Error: ${err.stack || err}\n`);
    process.exit(1);
  });
}
