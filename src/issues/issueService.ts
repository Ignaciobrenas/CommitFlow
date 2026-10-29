import { GitClient } from '../git/gitClient';
import { RemoteManager } from '../remotes/remoteManager';
import { PersistenceManager } from '../state/persistenceManager';
import { IssueBranchLinker } from './issueBranchLinker';
import { IssueComment, IssueContext, IssueInfo, RemoteRepoInfo } from '../remotes/types';
import { LruCache } from '../utils/lruCache';

export class IssueService {
  private static instance: IssueService;
  private readonly gitClient = GitClient.getInstance();
  private readonly remoteManager = RemoteManager.getInstance();
  private readonly persistence = PersistenceManager.getInstance();
  private readonly issueCache = new LruCache<string, IssueInfo>(200);

  public static getInstance(): IssueService {
    if (!IssueService.instance) {
      IssueService.instance = new IssueService();
    }
    return IssueService.instance;
  }

  /**
   * Retrieves issues assigned to the active user in the repository
   */
  public async getAssignedIssues(cwd: string): Promise<IssueInfo[]> {
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) return [];

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.getMyAssignedIssues) return [];

    const user = await this.gitClient.getUserIdentity(cwd);
    const issues = await provider.getMyAssignedIssues(remote, user.name);

    // Cache results & mark assigned flag
    issues.forEach((i) => {
      i.isAssignedToMe = true;
      this.issueCache.set(`${remote.owner}/${remote.repo}#${i.number}`, i);
    });

    return issues;
  }

  /**
   * Identifies issues explicitly linked to the active branch name or recent unpushed commits
   */
  public async getLinkedIssues(cwd: string, currentBranch?: string): Promise<IssueInfo[]> {
    const branch = currentBranch || (await this.gitClient.getCurrentBranch(cwd));
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) return [];

    const branchIssueNums = IssueBranchLinker.extractIssueNumbersFromBranch(branch);

    // Also scan recent commits for Closes #XX or Refs #XX
    const recentCommits = await this.gitClient.getCommits(cwd, 30);
    const commitIssueNums = IssueBranchLinker.extractIssueNumbersFromCommits(recentCommits);

    const targetNums = Array.from(new Set([...branchIssueNums, ...commitIssueNums]));
    if (targetNums.length === 0) return [];

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.getIssueDetails) return [];

    const linked: IssueInfo[] = [];
    for (const num of targetNums) {
      const cacheKey = `${remote.owner}/${remote.repo}#${num}`;
      let issue = this.issueCache.get(cacheKey);
      if (!issue) {
        issue = (await provider.getIssueDetails(remote, num)) || undefined;
      }
      if (issue) {
        issue.isLinkedToBranch = true;
        this.issueCache.set(cacheKey, issue);
        linked.push(issue);
      }
    }

    return linked;
  }

  /**
   * Retrieves all open issues, with optional filtering by labels, milestone, and search text
   */
  public async getAllIssues(
    cwd: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      labels?: string[];
      search?: string;
    } = {}
  ): Promise<IssueInfo[]> {
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) return [];

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.getIssues) return [];

    const issues = await provider.getIssues(remote, {
      state: options.state || 'open',
      labels: options.labels,
      limit: 100,
    });

    const user = await this.gitClient.getUserIdentity(cwd);
    const currentBranch = await this.gitClient.getCurrentBranch(cwd);
    const linkedNums = new Set(IssueBranchLinker.extractIssueNumbersFromBranch(currentBranch));

    // Cache and augment metadata
    for (const issue of issues) {
      if (
        user.name &&
        (issue.assignees.some((a) => a.name.toLowerCase() === user.name.toLowerCase()) ||
          issue.author.name.toLowerCase() === user.name.toLowerCase())
      ) {
        issue.isAssignedToMe = true;
      }
      if (linkedNums.has(issue.number)) {
        issue.isLinkedToBranch = true;
      }
      this.issueCache.set(`${remote.owner}/${remote.repo}#${issue.number}`, issue);
    }

    if (options.search && options.search.trim()) {
      const q = options.search.toLowerCase();
      return issues.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.body.toLowerCase().includes(q) ||
          String(i.number).includes(q)
      );
    }

    return issues;
  }

  /**
   * Gets single issue details
   */
  public async getIssue(cwd: string, issueNumber: number): Promise<IssueInfo | null> {
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) return null;

    const cacheKey = `${remote.owner}/${remote.repo}#${issueNumber}`;
    const cached = this.issueCache.get(cacheKey);
    if (cached) return cached;

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.getIssueDetails) return null;

    const issue = await provider.getIssueDetails(remote, issueNumber);
    if (issue) {
      this.issueCache.set(cacheKey, issue);
    }
    return issue;
  }

  /**
   * Gets comments for an issue
   */
  public async getIssueComments(cwd: string, issueNumber: number): Promise<IssueComment[]> {
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) return [];

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.getIssueComments) return [];

    return await provider.getIssueComments(remote, issueNumber);
  }

  /**
   * Adds a new comment to an issue
   */
  public async createComment(cwd: string, issueNumber: number, body: string): Promise<IssueComment> {
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) throw new Error('No remote repository detected');

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.createIssueComment) {
      throw new Error(`Issue comments are not supported for provider ${remote.provider}`);
    }

    return await provider.createIssueComment(remote, issueNumber, body);
  }

  /**
   * Toggles issue state (open/closed)
   */
  public async setIssueState(cwd: string, issueNumber: number, state: 'open' | 'closed'): Promise<void> {
    const remote = await this.getRemoteInfo(cwd);
    if (!remote) throw new Error('No remote repository detected');

    const provider = this.remoteManager.getProvider(remote.provider);
    if (!provider || !provider.setIssueState) {
      throw new Error(`Changing issue state is not supported for provider ${remote.provider}`);
    }

    await provider.setIssueState(remote, issueNumber, state);

    // Invalidate / update cache
    const cacheKey = `${remote.owner}/${remote.repo}#${issueNumber}`;
    const cached = this.issueCache.get(cacheKey);
    if (cached) {
      cached.state = state;
      this.issueCache.set(cacheKey, cached);
    }
  }

  /**
   * Starts work on an issue by generating a standardized branch or worktree
   */
  public async startWorkOnIssue(
    cwd: string,
    issueNumber: number,
    useWorktree: boolean = false
  ): Promise<{ branchName: string; isWorktree: boolean; path?: string }> {
    const issue = await this.getIssue(cwd, issueNumber);
    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found.`);
    }

    const pattern = this.persistence.getBranchNamingPattern();
    const branchName = IssueBranchLinker.generateBranchName(issue, pattern);

    if (useWorktree) {
      const worktreePath = await this.gitClient.createWorktree(cwd, branchName);
      return { branchName, isWorktree: true, path: worktreePath };
    } else {
      // Checkout new branch from current HEAD
      await this.gitClient.execute(['checkout', '-b', branchName], cwd);
      return { branchName, isWorktree: false };
    }
  }

  /**
   * Deep issue context: returns issue, comments, and referencing Git commits
   */
  public async getIssueContext(cwd: string, issueNumber: number): Promise<IssueContext> {
    const issue = await this.getIssue(cwd, issueNumber);
    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found.`);
    }

    const comments = await this.getIssueComments(cwd, issueNumber);

    // Search commits referencing this issue
    const commits = await this.gitClient.getCommits(cwd, 200);
    const pattern = new RegExp(`(?:#|issue[-/]|closes?\\s*#?)${issueNumber}\\b`, 'i');
    const referencingCommits = commits
      .filter((c) => pattern.test(c.subject) || pattern.test(c.body))
      .map((c) => ({
        hash: c.hash,
        shortHash: c.shortHash,
        subject: c.subject,
        author: c.author.name,
      }));

    return {
      issue,
      comments,
      referencingCommits,
    };
  }

  private async getRemoteInfo(cwd: string): Promise<RemoteRepoInfo | null> {
    return await this.gitClient.getRemoteRepoInfo(cwd);
  }
}
