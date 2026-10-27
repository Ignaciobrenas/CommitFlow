import * as readline from 'readline';
import * as path from 'path';
import { GitClient } from '../git/gitClient';

export class CommitFlowMcpServer {
  private readonly gitClient = GitClient.getInstance();
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
              version: '0.3.0',
            },
            capabilities: {
              tools: {},
              resources: {},
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'commitflow_get_user_impact',
                description:
                  'Get complete context of what the user/developer has done in this repository: total commits, repository authorship share, branches participated in, commit count per branch, and recent user commits.',
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              },
              {
                name: 'commitflow_get_active_context',
                description:
                  'Get the active Git branch context: current branch name, detached HEAD status, upstream synchronization status (ahead/behind commits), stashes, and uncommitted working tree changes.',
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
                  'Get deep Git authorship blame for a specific line in a file: who wrote it, when, in which commit SHA, and with what commit message.',
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
                uri: 'commitflow://repo/user-context',
                name: 'User Repository Activity Profile',
                description:
                  'Markdown formatted context of what the current developer has built, their commits, and active branches.',
                mimeType: 'text/markdown',
              },
              {
                uri: 'commitflow://repo/graph-summary',
                name: 'Git Branch & Commit Overview',
                description: 'Overview of recent commits and active branches.',
                mimeType: 'text/markdown',
              },
            ],
          },
        };

      case 'resources/read':
        return await this.handleResourceRead(id, params?.uri);

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
          const absPath = path.isAbsolute(args.filePath)
            ? args.filePath
            : path.resolve(this.repoRoot, args.filePath);
          const blame = await this.gitClient.getBlameForLine(absPath, args.line);
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
      let markdownContent = '';

      if (uri === 'commitflow://repo/user-context') {
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

        markdownContent = `# CommitFlow User Activity Context\n\n` +
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
      } else if (uri === 'commitflow://repo/graph-summary') {
        const commits = await this.gitClient.getCommits(this.repoRoot, 15);
        markdownContent = `# CommitFlow Recent Git Graph\n\n` +
          commits
            .map(
              (c) =>
                `- \`${c.shortHash}\` **${c.subject}** (${c.author.name}, ${c.author.relativeTime}) ${c.refs.map((r) => `[${r.name}]`).join(' ')}`
            )
            .join('\n');
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
              mimeType: 'text/markdown',
              text: markdownContent,
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
