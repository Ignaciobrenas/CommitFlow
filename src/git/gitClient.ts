import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitAuthor, GitBlameLine, GitBranch, GitCommit } from './types';
import { GitParser } from './gitParser';
import { AvatarService } from '../avatars/avatarService';

export class GitClient {
  private static instance: GitClient;
  private readonly avatarService = AvatarService.getInstance();
  private readonly blameCache = new Map<string, GitBlameLine>();

  public static getInstance(): GitClient {
    if (!GitClient.instance) {
      GitClient.instance = new GitClient();
    }
    return GitClient.instance;
  }

  /**
   * Executes a git command in the specified directory with cancellation support
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

      const child = cp.spawn('git', args, {
        cwd,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString('utf8');
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });

      const tokenListener = token?.onCancellationRequested(() => {
        child.kill();
        reject(new vscode.CancellationError());
      });

      child.on('error', (err) => {
        tokenListener?.dispose();
        reject(err);
      });

      child.on('close', (code) => {
        tokenListener?.dispose();
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed [code ${code}]: ${stderr.trim() || stdout.trim()}`));
        }
      });
    });
  }

  /**
   * Resolves the top-level repository root directory
   */
  public async getRepoRoot(cwd?: string): Promise<string | null> {
    const targetDir = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!targetDir) {
      return null;
    }

    try {
      const output = await this.execute(['rev-parse', '--show-toplevel'], targetDir);
      return output.trim();
    } catch {
      return null;
    }
  }

  /**
   * Retrieves commits from git log with parents, author metadata, refs, and subject
   */
  public async getCommits(
    cwd: string,
    limit = 300,
    skip = 0
  ): Promise<GitCommit[]> {
    const format = '%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%s%x1f%b%x1e';
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

    const raw = await this.execute(args, cwd);
    return GitParser.parseLogOutput(raw);
  }

  /**
   * Retrieves all local and remote branches along with their tracking status and tip commit author
   */
  public async getBranches(cwd: string): Promise<GitBranch[]> {
    const format =
      '%(refname)%(refname:short)%00%(HEAD)%00%(objectname)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(authorname)%00%(authoremail)%00%(authordate:unix)';
    const output = await this.execute(
      ['for-each-ref', `--format=${format}`, 'refs/heads', 'refs/remotes'],
      cwd
    );

    const lines = output.split('\n').filter((l) => l.trim().length > 0);
    const branches: GitBranch[] = [];

    for (const line of lines) {
      const parts = line.split('\0');
      if (parts.length < 8) {
        continue;
      }

      const [
        refname,
        isHead,
        commitHash,
        upstream,
        track,
        authorName,
        authorEmailRaw,
        authorDateRaw,
      ] = parts;

      const isRemote = refname.startsWith('refs/remotes/');
      const name = refname.replace(/^refs\/(heads|remotes)\//, '');
      const authorEmail = (authorEmailRaw || '').replace(/^<|>$/g, '').trim();
      const authorDate = new Date(parseInt(authorDateRaw, 10) * 1000);

      // Parse ahead / behind numbers
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
   * Retrieves the currently active branch name
   */
  public async getCurrentBranch(cwd: string): Promise<string> {
    try {
      const output = await this.execute(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      return output.trim();
    } catch {
      return '';
    }
  }

  /**
   * Obtains incremental git blame for a specific line in an active file
   */
  public async getBlameForLine(
    filePath: string,
    line: number,
    token?: vscode.CancellationToken
  ): Promise<GitBlameLine | null> {
    const cwd = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const cacheKey = `${filePath}#${line}`;

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
    } catch (err) {
      if (err instanceof vscode.CancellationError) {
        throw err;
      }
      return null;
    }
  }

  /**
   * Parses git blame --incremental output
   */
  private parseIncrementalBlame(
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
        authorEmail = trimmed.replace('author-mail ', '').replace(/^<|>$/g, '');
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
   * Retrieves files changed in a commit
   */
  public async getCommitFiles(cwd: string, hash: string): Promise<string[]> {
    try {
      const output = await this.execute(
        ['diff-tree', '--no-commit-id', '--name-only', '-r', hash],
        cwd
      );
      return output.split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Switches / checkouts a branch
   */
  public async checkoutBranch(cwd: string, branchName: string): Promise<void> {
    await this.execute(['checkout', branchName], cwd);
  }
}
