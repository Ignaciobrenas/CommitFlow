import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  BranchParticipation,
  ContributorStat,
  GitAuthor,
  GitBlameLine,
  GitBranch,
  GitCommit,
  GitFileChange,
  RepoStats,
  UserPersonalStats,
} from './types';
import { GitParser } from './gitParser';
import { AvatarService } from '../avatars/avatarService';
import { GitHubService, GitHubRepoInfo } from './githubService';
import { LruCache } from '../utils/lruCache';

export class GitClient {
  private static instance: GitClient;
  private readonly avatarService = AvatarService.getInstance();
  private readonly blameCache = new LruCache<string, GitBlameLine>(500);

  public static getInstance(): GitClient {
    if (!GitClient.instance) {
      GitClient.instance = new GitClient();
    }
    return GitClient.instance;
  }

  /**
   * Executes a git command in the specified directory with cancellation and edge-case resilience
   */
  public execute(
    args: string[],
    cwd: string,
    token?: vscode.CancellationToken
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (token?.isCancellationRequested) {
        return reject(new vscode.CancellationError());
      }

      // Ensure UTF-8 and disable octal escaping for filenames with non-ASCII / spaces
      const normalizedArgs = ['-c', 'core.quotepath=false', ...args];

      let child: cp.ChildProcess;
      try {
        child = cp.spawn('git', normalizedArgs, {
          cwd,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            LC_ALL: 'C.UTF-8',
          },
          windowsHide: true,
        });
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return reject(
            new Error(
              'Git executable was not found in your system PATH. Please install Git (https://git-scm.com).'
            )
          );
        }
        return reject(err);
      }

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString('utf8');
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString('utf8');
      });

      const tokenListener = token?.onCancellationRequested(() => {
        try {
          child.kill();
        } catch {}
        reject(new vscode.CancellationError());
      });

      child.on('error', (err: any) => {
        tokenListener?.dispose();
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              'Git executable was not found in your system PATH. Please install Git (https://git-scm.com).'
            )
          );
        } else {
          reject(err);
        }
      });

      child.on('close', (code) => {
        tokenListener?.dispose();
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(
              `Git command failed [code ${code}]: ${
                stderr.trim() || stdout.trim()
              }`
            )
          );
        }
      });
    });
  }

  /**
   * Resolves repository root dynamically from a given file path, active editor, or workspace folder
   */
  public async getRepoRoot(hintPath?: string): Promise<string | null> {
    let targetDir = hintPath;

    if (!targetDir && vscode.window.activeTextEditor?.document.uri.scheme === 'file') {
      targetDir = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
    }

    if (!targetDir) {
      targetDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    if (!targetDir) {
      return null;
    }

    try {
      const output = await this.execute(
        ['rev-parse', '--show-toplevel'],
        targetDir
      );
      return output.trim();
    } catch {
      return null;
    }
  }

  /**
   * Resolves the real physical path of the HEAD file (supports Git Worktrees and Submodules)
   */
  public async getGitHeadPath(cwd: string): Promise<string | null> {
    try {
      const output = await this.execute(['rev-parse', '--git-path', 'HEAD'], cwd);
      const relativeOrAbsolute = output.trim();
      return path.isAbsolute(relativeOrAbsolute)
        ? relativeOrAbsolute
        : path.resolve(cwd, relativeOrAbsolute);
    } catch {
      return null;
    }
  }

  /**
   * Retrieves commits from git log with parents, author metadata, refs, and subject.
   * Gracefully handles brand new empty repositories (unborn branches).
   */
  public async getCommits(
    cwd: string,
    limit = 300,
    skip = 0
  ): Promise<GitCommit[]> {
    const format =
      '%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s%x1f%b%x1e';
    const args = [
      'log',
      '--all',
      '--topo-order',
      '--parents',
      `--format=${format}`,
      `-n`,
      limit.toString(),
      `--skip=${skip}`,
    ];

    try {
      const raw = await this.execute(args, cwd);
      return GitParser.parseLogOutput(raw);
    } catch (err: any) {
      // Empty repo or unborn branch edge case (fatal: your current branch does not have any commits yet)
      if (
        err.message.includes('does not have any commits') ||
        err.message.includes('unknown revision or path') ||
        err.message.includes('bad default revision')
      ) {
        return [];
      }
      throw err;
    }
  }

  /**
   * Retrieves all local and remote branches along with their tracking status and tip commit author
   */
  public async getBranches(cwd: string): Promise<GitBranch[]> {
    const format =
      '%(refname)%00%(refname:short)%00%(HEAD)%00%(objectname)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(authorname)%00%(authoremail)%00%(authordate:unix)';
    
    let output = '';
    try {
      output = await this.execute(
        ['for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes'],
        cwd
      );
    } catch (err: any) {
      // In completely empty repositories, refs don't exist yet
      return [];
    }

    const lines = output.split('\n').filter((l) => l.trim().length > 0);
    const branches: GitBranch[] = [];

    for (const line of lines) {
      const parts = line.split('\0');
      if (parts.length < 9) {
        continue;
      }

      const [
        refname,
        shortName,
        isHead,
        commitHash,
        upstream,
        track,
        authorName,
        authorEmailRaw,
        authorDateRaw,
      ] = parts;

      const isRemote = refname.startsWith('refs/remotes/');
      const name = shortName.trim() || refname.replace(/^refs\/(heads|remotes)\//, '');
      const authorEmail = (authorEmailRaw || '').replace(/^<|>$/g, '').trim();
      const parsedTimestamp = parseInt(authorDateRaw, 10);
      const authorDate = isNaN(parsedTimestamp)
        ? new Date()
        : new Date(parsedTimestamp * 1000);

      let ahead = 0;
      let behind = 0;
      if (track) {
        const aheadMatch = track.match(/ahead (\d+)/);
        const behindMatch = track.match(/behind (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
      }

      const lastAuthor: GitAuthor = {
        name: authorName || 'Unknown',
        email: authorEmail,
        date: authorDate,
        relativeTime: GitParser.formatRelativeTime(authorDate),
        avatarUrl: this.avatarService.getAvatarUrl(authorName, authorEmail),
      };

      branches.push({
        name,
        fullName: refname,
        isRemote,
        isCurrent: isHead.trim() === '*',
        commitHash: commitHash.trim(),
        upstream: upstream.trim() || undefined,
        ahead,
        behind,
        lastAuthor,
      });
    }

    return branches;
  }

  /**
   * Retrieves the currently active branch name (handles detached HEAD gracefully)
   */
  public async getCurrentBranch(cwd: string): Promise<string> {
    try {
      const output = await this.execute(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        cwd
      );
      const branch = output.trim();
      if (branch === 'HEAD') {
        // Detached HEAD state: retrieve short commit hash
        const shortSha = (await this.execute(['rev-parse', '--short', 'HEAD'], cwd)).trim();
        return `HEAD (detached at ${shortSha})`;
      }
      return branch;
    } catch {
      return 'main';
    }
  }

  /**
   * Obtains incremental git blame for a specific line in an active file.
   * Handles untracked files, binary files, and uncommitted local changes seamlessly.
   */
  public async getBlameForLine(
    filePath: string,
    line: number,
    token?: vscode.CancellationToken
  ): Promise<GitBlameLine | null> {
    const cwd = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const cacheKey = `${filePath}#${line}`;

    const cached = this.blameCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Edge case: line number 0 or negative
    if (line <= 0) {
      return null;
    }

    const args = [
      'blame',
      '--incremental',
      `-L`,
      `${line},${line}`,
      '--',
      fileName,
    ];

    try {
      const output = await this.execute(args, cwd, token);
      const parsed = this.parseIncrementalBlame(output, line, fileName);
      if (parsed) {
        this.blameCache.set(cacheKey, parsed);
      }
      return parsed;
    } catch (err: any) {
      if (err instanceof vscode.CancellationError) {
        throw err;
      }
      // Edge case: file is untracked, binary, or line exceeds file length
      return null;
    }
  }

  /**
   * Invalidates cached blame entries when a file is saved or changed
   */
  public invalidateBlameForFile(filePath: string): void {
    this.blameCache.deleteMatching((key) => key.startsWith(filePath));
  }

  /**
   * Parses git blame --incremental output with uncommitted changes handling
   */
  public parseIncrementalBlame(
    raw: string,
    line: number,
    filename: string
  ): GitBlameLine | null {
    if (!raw || !raw.trim()) {
      return null;
    }

    const lines = raw.split('\n');
    let commitHash = '';
    let authorName = 'Unknown';
    let authorEmail = '';
    let authorTime = 0;
    let summary = '';
    let previousHash: string | undefined;

    for (const l of lines) {
      const trimmed = l.trim();
      if (!commitHash && /^[0-9a-f]{40}/i.test(trimmed)) {
        commitHash = trimmed.split(' ')[0];
      } else if (trimmed.startsWith('author ')) {
        authorName = trimmed.replace('author ', '');
      } else if (trimmed.startsWith('author-mail ')) {
        authorEmail = trimmed
          .replace('author-mail ', '')
          .replace(/^<|>$/g, '');
      } else if (trimmed.startsWith('author-time ')) {
        authorTime = parseInt(trimmed.replace('author-time ', ''), 10);
      } else if (trimmed.startsWith('summary ')) {
        summary = trimmed.replace('summary ', '');
      } else if (trimmed.startsWith('previous ')) {
        previousHash = trimmed.split(' ')[1];
      }
    }

    if (!commitHash) {
      return null;
    }

    // Edge case: Uncommitted local line modification (Hash is all zeros)
    const isUncommitted = /^0{40}$/.test(commitHash);
    if (isUncommitted) {
      const date = new Date();
      const author: GitAuthor = {
        name: 'You (Uncommitted)',
        email: authorEmail,
        date,
        relativeTime: 'Local changes',
        avatarUrl: this.avatarService.getAvatarUrl('You', authorEmail),
      };

      return {
        line,
        commitHash: '0000000',
        shortHash: 'Working Tree',
        author,
        summary: 'Uncommitted local modifications',
        previousHash,
        filename,
      };
    }

    const date = new Date(authorTime * 1000);
    const author: GitAuthor = {
      name: authorName,
      email: authorEmail,
      date,
      relativeTime: GitParser.formatRelativeTime(date),
      avatarUrl: this.avatarService.getAvatarUrl(authorName, authorEmail),
    };

    return {
      line,
      commitHash,
      shortHash: commitHash.slice(0, 7),
      author,
      summary,
      previousHash,
      filename,
    };
  }

  /**
   * Retrieves detailed list of changed files for a commit (status: M, A, D, R)
   */
  public async getCommitFilesDetailed(
    cwd: string,
    hash: string
  ): Promise<GitFileChange[]> {
    try {
      const output = await this.execute(
        ['diff-tree', '--no-commit-id', '--name-status', '-r', '-m', '--root', hash],
        cwd
      );

      const lines = output.split('\n').filter((l) => l.trim().length > 0);
      const changes: GitFileChange[] = [];

      for (const line of lines) {
        const parts = line.split(/\t+/);
        if (parts.length < 2) continue;

        const rawStatus = parts[0].trim();
        const statusCode = (rawStatus[0] || 'M') as GitFileChange['status'];

        if (statusCode === 'R' && parts.length >= 3) {
          changes.push({
            status: 'R',
            oldPath: parts[1].trim(),
            path: parts[2].trim(),
          });
        } else {
          changes.push({
            status: statusCode,
            path: parts[1].trim(),
          });
        }
      }

      return changes;
    } catch {
      return [];
    }
  }

  /**
   * Computes repository statistics and top contributors
   */
  public computeRepoStats(
    commits: GitCommit[],
    branches: GitBranch[]
  ): RepoStats {
    const authorCounts = new Map<
      string,
      { name: string; email: string; avatarUrl: string; count: number }
    >();

    for (const commit of commits) {
      const email = commit.author.email.toLowerCase().trim() || commit.author.name;
      const existing = authorCounts.get(email);
      if (existing) {
        existing.count++;
      } else {
        authorCounts.set(email, {
          name: commit.author.name,
          email: commit.author.email,
          avatarUrl: commit.author.avatarUrl,
          count: 1,
        });
      }
    }

    const totalCommits = commits.length;
    const sorted = Array.from(authorCounts.values()).sort(
      (a, b) => b.count - a.count
    );

    const topContributors: ContributorStat[] = sorted.slice(0, 5).map((c) => ({
      name: c.name,
      email: c.email,
      avatarUrl: c.avatarUrl,
      commitsCount: c.count,
      percentage: totalCommits > 0 ? Math.round((c.count / totalCommits) * 100) : 0,
    }));

    return {
      totalCommits,
      totalContributors: authorCounts.size,
      activeBranches: branches.length,
      topContributors,
    };
  }

  /**
   * Retrieves the current user identity from git config
   */
  public async getUserIdentity(cwd: string): Promise<{ name: string; email: string }> {
    let name = '';
    let email = '';

    try {
      name = (await this.execute(['config', 'user.name'], cwd)).trim();
    } catch {}

    try {
      email = (await this.execute(['config', 'user.email'], cwd)).trim();
    } catch {}

    return { name: name || 'You', email: email || '' };
  }

  /**
   * Computes personalized contribution analytics for the current developer:
   * - Total commits authored by you
   * - Percentage of repository authored by you
   * - All branches you participated in and personal commit counts per branch
   */
  public computePersonalStats(
    commits: GitCommit[],
    branches: GitBranch[],
    userName: string,
    userEmail: string
  ): UserPersonalStats {
    const targetEmail = userEmail.toLowerCase().trim();
    const targetName = userName.toLowerCase().trim();

    const isMe = (c: GitCommit) => {
      const cEmail = c.author.email.toLowerCase().trim();
      const cName = c.author.name.toLowerCase().trim();
      if (targetEmail && cEmail === targetEmail) return true;
      if (targetName && cName === targetName) return true;
      return false;
    };

    const myCommits = commits.filter(isMe);
    const myTotalCommits = myCommits.length;
    const repoTotalCommits = commits.length;
    const commitPercentage =
      repoTotalCommits > 0 ? Math.round((myTotalCommits / repoTotalCommits) * 100) : 0;

    // Build commit map for fast ancestor tracing
    const commitMap = new Map<string, GitCommit>();
    commits.forEach((c) => commitMap.set(c.hash, c));

    const participatedBranches: BranchParticipation[] = [];

    for (const b of branches) {
      // Trace reachable commits from branch tip
      const visited = new Set<string>();
      const queue = [b.commitHash];
      let branchTotal = 0;
      let branchMine = 0;

      while (queue.length > 0) {
        const hash = queue.shift()!;
        if (visited.has(hash)) continue;
        visited.add(hash);

        const commit = commitMap.get(hash);
        if (commit) {
          branchTotal++;
          if (isMe(commit)) {
            branchMine++;
          }
          for (const parent of commit.parentHashes) {
            if (!visited.has(parent)) {
              queue.push(parent);
            }
          }
        }
      }

      // If you participated in this branch, record it
      if (branchMine > 0 || isMe({ author: b.lastAuthor } as any)) {
        const myCount = Math.max(branchMine, isMe({ author: b.lastAuthor } as any) ? 1 : 0);
        const total = Math.max(branchTotal, 1);
        participatedBranches.push({
          branchName: b.name,
          isCurrent: b.isCurrent,
          isRemote: b.isRemote,
          myCommitsCount: myCount,
          totalCommitsCount: total,
          percentage: Math.round((myCount / total) * 100),
        });
      }
    }

    // Sort branches by most commits by you
    participatedBranches.sort((a, b) => b.myCommitsCount - a.myCommitsCount);

    return {
      userName,
      userEmail,
      avatarUrl: this.avatarService.getAvatarUrl(userName, userEmail),
      myTotalCommits,
      repoTotalCommits,
      commitPercentage,
      participatedBranchesCount: participatedBranches.length,
      branches: participatedBranches,
    };
  }

  /**
   * Retrieves GitHub repository metadata from git remote config
   */
  public async getGitHubRepoInfo(cwd: string): Promise<GitHubRepoInfo | null> {
    try {
      const output = await this.execute(
        ['config', '--get', 'remote.origin.url'],
        cwd
      );
      return GitHubService.getInstance().parseRemoteUrl(output);
    } catch {
      return null;
    }
  }

  /**
   * Switches / checkouts a branch
   */
  public async checkoutBranch(cwd: string, branchName: string): Promise<void> {
    await this.execute(['checkout', branchName], cwd);
  }

  /**
   * Checkouts a specific commit hash (detached HEAD)
   */
  public async checkoutCommit(cwd: string, hash: string): Promise<void> {
    await this.execute(['checkout', hash], cwd);
  }

  /**
   * Pulls the latest commits for the current branch from its upstream tracking branch
   */
  public async pull(cwd: string): Promise<string> {
    return await this.execute(['pull'], cwd);
  }

  /**
   * Fetches latest refs from all remotes
   */
  public async fetch(cwd: string): Promise<string> {
    try {
      return await this.execute(['fetch', '--all', '--prune'], cwd);
    } catch (e: any) {
      return e.message || String(e);
    }
  }

  /**
   * Checks upstream sync status (ahead, behind, and if incoming commits contain merges)
   */
  public async getUpstreamStatus(
    cwd: string
  ): Promise<{ behind: number; ahead: number; hasMerge: boolean; upstreamBranch: string } | null> {
    try {
      const upstream = (
        await this.execute(['rev-parse', '--abbrev-ref', '@{u}'], cwd)
      ).trim();
      if (!upstream) return null;

      const counts = (
        await this.execute(['rev-list', '--left-right', '--count', 'HEAD...@{u}'], cwd)
      ).trim();
      const [aheadStr, behindStr] = counts.split(/\s+/);
      const ahead = parseInt(aheadStr, 10) || 0;
      const behind = parseInt(behindStr, 10) || 0;

      let hasMerge = false;
      if (behind > 0) {
        const mergeCheck = (
          await this.execute(['rev-list', '--merges', '-1', 'HEAD..@{u}'], cwd)
        ).trim();
        hasMerge = mergeCheck.length > 0;
      }

      return { behind, ahead, hasMerge, upstreamBranch: upstream };
    } catch {
      return null;
    }
  }

  /**
   * Retrieves uncommitted working tree changes (staged and unstaged)
   */
  public async getWorkingTreeChanges(cwd: string): Promise<GitFileChange[]> {
    try {
      const output = await this.execute(['status', '--porcelain=v1', '-u'], cwd);
      const lines = output.split('\n').filter((l) => l.trim().length > 0);
      const changes: GitFileChange[] = [];

      for (const line of lines) {
        if (line.length < 3) continue;
        const code = line.slice(0, 2).trim();
        const filePath = line.slice(3).trim();

        let status: GitFileChange['status'] = 'M';
        if (code.includes('?')) status = 'A';
        else if (code.includes('A')) status = 'A';
        else if (code.includes('D')) status = 'D';
        else if (code.includes('R')) status = 'R';

        changes.push({ status, path: filePath });
      }

      return changes;
    } catch {
      return [];
    }
  }
}
