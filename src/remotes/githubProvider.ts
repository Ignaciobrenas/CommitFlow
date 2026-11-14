import { GitAuthor, PullRequestInfo } from '../git/types';
import {
  IssueComment,
  IssueInfo,
  ParsedRemote,
  RemoteProvider,
  RemoteProviderType,
  RemoteRepoInfo,
} from './types';
import { PersistenceManager } from '../state/persistenceManager';
import { LruCache } from '../utils/lruCache';

export class GitHubProvider implements RemoteProvider {
  public readonly type: RemoteProviderType = 'github';
  private readonly persistence = PersistenceManager.getInstance();
  private readonly prsCache = new LruCache<string, PullRequestInfo[]>(30, 120_000);
  private readonly statusesCache = new LruCache<
    string,
    Array<{ context: string; state: 'success' | 'failure' | 'pending' | 'warning' | 'error'; description?: string; targetUrl?: string }>
  >(100, 120_000);

  private getApiBaseUrl(repoInfo: RemoteRepoInfo): string {
    const cleanHost = (repoInfo.host || 'github.com').toLowerCase();
    if (cleanHost === 'github.com' || cleanHost.endsWith('.github.com')) {
      return 'https://api.github.com';
    }
    return `https://${cleanHost}/api/v3`;
  }

  public matches(_remoteUrl: string, host: string): boolean {
    const cleanHost = host.toLowerCase();
    return cleanHost === 'github.com' || cleanHost.includes('github');
  }

  public getWebUrl(parsed: ParsedRemote): string {
    const host = parsed.resolvedHost || parsed.host;
    return `https://${host}/${parsed.owner}/${parsed.repo}`;
  }

  public getCommitUrl(repoInfo: RemoteRepoInfo, commitHash: string): string {
    return `${repoInfo.webUrl}/commit/${commitHash}`;
  }

  public getBranchUrl(repoInfo: RemoteRepoInfo, branchName: string): string {
    const clean = branchName.replace(/^origin\//, '');
    return `${repoInfo.webUrl}/tree/${encodeURIComponent(clean)}`;
  }

  public getIssueUrl(repoInfo: RemoteRepoInfo, issueNumber: number | string): string {
    return `${repoInfo.webUrl}/issues/${issueNumber}`;
  }

  public getPullRequestUrl(repoInfo: RemoteRepoInfo, prNumber: number | string): string {
    return `${repoInfo.webUrl}/pull/${prNumber}`;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token =
      (await this.persistence.getSecret('commitflow.token.github')) ||
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CommitFlow-VSCode-Extension',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    return headers;
  }

  public async getIssues(
    repoInfo: RemoteRepoInfo,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string[]; page?: number; limit?: number } = {}
  ): Promise<IssueInfo[]> {
    const state = options.state === 'all' ? 'all' : options.state || 'open';
    const limit = options.limit || 50;
    const page = options.page || 1;
    let url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=${state}&per_page=${limit}&page=${page}`;
    if (options.labels && options.labels.length > 0) {
      url += `&labels=${encodeURIComponent(options.labels.join(','))}`;
    }

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw
        .filter((item) => !item.pull_request)
        .map((item) => this.mapGitHubIssue(item, repoInfo));
    } catch {
      return [];
    }
  }

  public async getMyAssignedIssues(repoInfo: RemoteRepoInfo, currentUser?: string): Promise<IssueInfo[]> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=open&per_page=50`;
      if (currentUser) {
        url += `&assignee=${encodeURIComponent(currentUser)}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw
        .filter((item) => !item.pull_request)
        .map((item) => this.mapGitHubIssue(item, repoInfo));
    } catch {
      return [];
    }
  }

  public async getIssueDetails(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueInfo | null> {
    const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const raw: any = await res.json();
      return this.mapGitHubIssue(raw, repoInfo);
    } catch {
      return null;
    }
  }

  public async getIssueComments(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueComment[]> {
    const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}/comments`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const rawComments: any[] = await res.json();
      return rawComments.map((raw) => ({
        id: raw.id,
        author: {
          name: raw.user?.login || 'User',
          email: '',
          date: new Date(raw.created_at),
          relativeTime: this.formatRelativeTime(new Date(raw.created_at)),
          avatarUrl: raw.user?.avatar_url || '',
        },
        body: raw.body || '',
        createdAt: raw.created_at,
      }));
    } catch {
      return [];
    }
  }

  public async createIssueComment(
    repoInfo: RemoteRepoInfo,
    issueNumber: number,
    body: string
  ): Promise<IssueComment> {
    const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}/comments`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create comment on GitHub: HTTP ${res.status}`);
    }
    const raw: any = await res.json();
    return {
      id: raw.id,
      author: {
        name: raw.user?.login || 'You',
        email: '',
        date: new Date(raw.created_at),
        relativeTime: 'just now',
        avatarUrl: raw.user?.avatar_url || '',
      },
      body: raw.body || '',
      createdAt: raw.created_at,
    };
  }

  public async setIssueState(
    repoInfo: RemoteRepoInfo,
    issueNumber: number,
    state: 'open' | 'closed'
  ): Promise<void> {
    const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update GitHub issue: HTTP ${res.status}`);
    }
  }

  public async getPullRequests(
    repoInfo: RemoteRepoInfo,
    filter: 'blocked' | 'ready' | 'mine' | 'all' = 'all'
  ): Promise<PullRequestInfo[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:prs:${filter}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=open&per_page=50`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const raw: any[] = await res.json();
        const prs: PullRequestInfo[] = raw.map((r) => {
          const isDraft = r.draft === true;
          const isBlocked =
            r.mergeable === false ||
            r.mergeable_state === 'dirty' ||
            r.mergeable_state === 'blocked';
          const reviewStatus: PullRequestInfo['reviewStatus'] =
            Array.isArray(r.requested_reviewers) && r.requested_reviewers.length > 0
              ? 'review_required'
              : 'none';
          const isReady = !isDraft && !isBlocked;
          return {
            id: r.id,
            number: r.number,
            title: r.title,
            state: isDraft ? 'draft' : 'open',
            reviewStatus,
            ciStatus: 'none',
            author: {
              name: r.user?.login || 'User',
              email: '',
              date: new Date(r.created_at),
              relativeTime: this.formatRelativeTime(new Date(r.created_at)),
              avatarUrl: r.user?.avatar_url || '',
            },
            sourceBranch: r.head?.ref || '',
            targetBranch: r.base?.ref || '',
            url: r.html_url || `${repoInfo.webUrl}/pull/${r.number}`,
            updatedAt: r.updated_at,
            isBlocked,
            isReady,
            isPending: !isBlocked && !isReady,
            commentsCount: r.comments,
          };
        });
        const filtered = this.filterPullRequests(prs, filter);
        this.prsCache.set(cacheKey, filtered);
        return filtered;
      }
    } catch {
      // Fallback to cached results on network error
    }
    return this.prsCache.get(cacheKey) || [];
  }

  private filterPullRequests(
    prs: PullRequestInfo[],
    filter: 'blocked' | 'ready' | 'mine' | 'all'
  ): PullRequestInfo[] {
    if (filter === 'blocked') return prs.filter((p) => p.isBlocked);
    if (filter === 'ready') return prs.filter((p) => p.isReady);
    return prs;
  }

  public async getCommitStatuses(
    repoInfo: RemoteRepoInfo,
    sha: string
  ): Promise<Array<{ context: string; state: 'success' | 'failure' | 'pending' | 'warning' | 'error'; description?: string; targetUrl?: string }>> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:status:${sha}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/commits/${sha}/status`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data: any = await res.json();
        const rawList: any[] = Array.isArray(data?.statuses) ? data.statuses : [];
        const mapped = rawList.map((s) => ({
          context: s.context || 'ci',
          state: (s.state === 'success' || s.state === 'failure' || s.state === 'pending' || s.state === 'error'
            ? s.state
            : 'pending') as 'success' | 'failure' | 'pending' | 'warning' | 'error',
          description: s.description,
          targetUrl: s.target_url,
        }));
        this.statusesCache.set(cacheKey, mapped);
        return mapped;
      }
    } catch {}
    return this.statusesCache.get(cacheKey) || [];
  }

  public async getPullRequestComments(repoInfo: RemoteRepoInfo, prNumber: number): Promise<IssueComment[]> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${prNumber}/comments`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw.map((c) => ({
        id: c.id,
        author: {
          name: c.user?.login || 'User',
          email: '',
          date: new Date(c.created_at),
          relativeTime: this.formatRelativeTime(new Date(c.created_at)),
          avatarUrl: c.user?.avatar_url || '',
        },
        body: c.body || '',
        createdAt: c.created_at,
      }));
    } catch {
      return [];
    }
  }

  public async createPullRequestComment(
    repoInfo: RemoteRepoInfo,
    prNumber: number,
    body: string
  ): Promise<IssueComment> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${prNumber}/comments`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitHub PR comment failed: HTTP ${res.status}`);
    }
    const c: any = await res.json();
    return {
      id: c.id,
      author: {
        name: c.user?.login || 'Me',
        email: '',
        date: new Date(c.created_at || Date.now()),
        relativeTime: 'just now',
        avatarUrl: c.user?.avatar_url || '',
      },
      body: c.body || body,
      createdAt: c.created_at || new Date().toISOString(),
    };
  }

  public async approvePullRequest(repoInfo: RemoteRepoInfo, prNumber: number): Promise<void> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/pulls/${prNumber}/reviews`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event: 'APPROVE' }),
    });
    if (!res.ok) {
      throw new Error(`GitHub PR approval failed: HTTP ${res.status}`);
    }
  }

  private mapGitHubIssue(raw: any, repoInfo: RemoteRepoInfo): IssueInfo {
    const author: GitAuthor = {
      name: raw.user?.login || 'User',
      email: '',
      date: new Date(raw.created_at),
      relativeTime: this.formatRelativeTime(new Date(raw.created_at)),
      avatarUrl: raw.user?.avatar_url || '',
    };
    const assignees = (raw.assignees || []).map((u: any) => ({
      name: u.login,
      email: '',
      date: new Date(),
      relativeTime: '',
      avatarUrl: u.avatar_url || '',
    }));
    const labels = (raw.labels || []).map((l: any) => ({
      name: l.name,
      color: l.color ? (l.color.startsWith('#') ? l.color : `#${l.color}`) : '#3b82f6',
      description: l.description,
    }));

    return {
      id: raw.id,
      number: raw.number,
      title: raw.title || '',
      body: raw.body || '',
      state: raw.state === 'closed' ? 'closed' : 'open',
      author,
      assignees,
      labels,
      milestone: raw.milestone ? { title: raw.milestone.title, dueOn: raw.milestone.due_on } : undefined,
      commentsCount: raw.comments || 0,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      url: raw.html_url || `${repoInfo.webUrl}/issues/${raw.number}`,
    };
  }

  private formatRelativeTime(date: Date): string {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
}
