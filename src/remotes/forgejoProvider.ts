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

export interface ForgejoCommitStatus {
  context: string;
  state: 'success' | 'failure' | 'pending' | 'warning' | 'error';
  description?: string;
  targetUrl?: string;
}

export interface ForgejoMilestone {
  id: number;
  title: string;
  description?: string;
  state: string;
  dueOn?: string;
}

export class ForgejoProvider implements RemoteProvider {
  public readonly type: RemoteProviderType = 'forgejo';
  private readonly persistence = PersistenceManager.getInstance();

  // Local in-memory caches for zero-latency UI and robust offline fallback
  private readonly issuesCache = new LruCache<string, IssueInfo[]>(50);
  private readonly issueDetailsCache = new LruCache<string, IssueInfo>(100);
  private readonly commentsCache = new LruCache<string, IssueComment[]>(100);
  private readonly prsCache = new LruCache<string, PullRequestInfo[]>(50);
  private readonly repoDetailsCache = new LruCache<string, Record<string, any>>(20);
  private readonly labelsCache = new LruCache<string, Array<{ name: string; color: string; description?: string }>>(20);
  private readonly milestonesCache = new LruCache<string, ForgejoMilestone[]>(20);

  /**
   * Pings /api/v1/version or uses domain heuristic to detect Forgejo or Gitea instance
   */
  public async matches(remoteUrl: string, host: string): Promise<boolean> {
    const cleanHost = host.toLowerCase();
    if (
      cleanHost === 'github.com' ||
      cleanHost === 'gitlab.com' ||
      cleanHost === 'bitbucket.org'
    ) {
      return false;
    }

    // Quick heuristic if hostname contains forgejo or gitea
    if (cleanHost.includes('forgejo') || cleanHost.includes('gitea')) {
      return true;
    }

    // Check configured instances next
    const instances = this.persistence.getForgejoInstances();
    if (instances.some((inst) => inst.toLowerCase().includes(cleanHost) || cleanHost.includes(inst.toLowerCase()))) {
      return true;
    }

    // Silent ping to /api/v1/version
    return await this.probeForgejoApi(host);
  }

  public async probeForgejoApi(host: string, port?: number): Promise<boolean> {
    const protocols = ['https', 'http'];
    for (const proto of protocols) {
      const portPart = port && port !== 80 && port !== 443 ? `:${port}` : '';
      const url = `${proto}://${host}${portPart}/api/v1/version`;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeout);
        if (res.ok) {
          const json: any = await res.json();
          if (json && typeof json.version === 'string') {
            return true;
          }
        }
      } catch {
        // Continue to next proto
      }
    }
    return false;
  }

  public getWebUrl(parsed: ParsedRemote): string {
    const host = parsed.resolvedHost || parsed.host;
    const portPart = parsed.protocol === 'http' || parsed.protocol === 'https'
      ? (parsed.port && parsed.port !== 80 && parsed.port !== 443 ? `:${parsed.port}` : '')
      : '';
    const scheme = parsed.protocol === 'http' ? 'http' : 'https';
    return `${scheme}://${host}${portPart}/${parsed.owner}/${parsed.repo}`;
  }

  public getCommitUrl(repoInfo: RemoteRepoInfo, commitHash: string): string {
    return `${repoInfo.webUrl}/commit/${commitHash}`;
  }

  public getBranchUrl(repoInfo: RemoteRepoInfo, branchName: string): string {
    const clean = branchName.replace(/^origin\//, '');
    return `${repoInfo.webUrl}/src/branch/${encodeURIComponent(clean)}`;
  }

  public getIssueUrl(repoInfo: RemoteRepoInfo, issueNumber: number | string): string {
    return `${repoInfo.webUrl}/issues/${issueNumber}`;
  }

  public getPullRequestUrl(repoInfo: RemoteRepoInfo, prNumber: number | string): string {
    return `${repoInfo.webUrl}/pulls/${prNumber}`;
  }

  private async getAuthHeaders(repoInfo: RemoteRepoInfo): Promise<Record<string, string>> {
    const host = repoInfo.host || new URL(repoInfo.webUrl).hostname;
    const token = await this.persistence.getForgejoToken(host);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }
    return headers;
  }

  private getApiBaseUrl(repoInfo: RemoteRepoInfo): string {
    try {
      const u = new URL(repoInfo.webUrl);
      return `${u.protocol}//${u.host}/api/v1`;
    } catch {
      return `https://${repoInfo.host || 'localhost'}/api/v1`;
    }
  }

  /**
   * Helper fetch with timeout to prevent hanging when offline
   */
  private async safeFetch(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Verifies credentials against /api/v1/user
   */
  public async verifyToken(
    host: string,
    token: string,
    protocol: 'https' | 'http' = 'https'
  ): Promise<{ isValid: boolean; username?: string; email?: string; avatarUrl?: string }> {
    const url = `${protocol}://${host}/api/v1/user`;
    try {
      const res = await this.safeFetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `token ${token}`,
        },
      });
      if (res.ok) {
        const json: any = await res.json();
        return {
          isValid: true,
          username: json.login || json.username,
          email: json.email,
          avatarUrl: json.avatar_url,
        };
      }
    } catch {}
    return { isValid: false };
  }

  /**
   * Retrieves full repository details (description, stars, open issues, default branch)
   */
  public async getRepoDetails(repoInfo: RemoteRepoInfo): Promise<Record<string, any> | null> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const json: any = await res.json();
        this.repoDetailsCache.set(cacheKey, json);
        return json;
      }
    } catch {
      // Offline fallback
    }

    return this.repoDetailsCache.get(cacheKey) || null;
  }

  /**
   * Retrieves open/closed issues from Forgejo repo with offline caching
   */
  public async getIssues(
    repoInfo: RemoteRepoInfo,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string[]; page?: number; limit?: number } = {}
  ): Promise<IssueInfo[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:${options.state || 'open'}:${(options.labels || []).join(',')}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const stateParam = options.state === 'all' ? 'all' : options.state || 'open';
    const limit = options.limit || 50;
    const page = options.page || 1;

    let url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=${stateParam}&page=${page}&limit=${limit}`;
    if (options.labels && options.labels.length > 0) {
      url += `&labels=${encodeURIComponent(options.labels.join(','))}`;
    }

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawIssues: any[] = await res.json();
        const mapped = rawIssues
          .filter((raw) => !raw.pull_request)
          .map((raw) => this.mapForgejoIssue(raw, repoInfo));
        this.issuesCache.set(cacheKey, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[ForgejoProvider] getIssues failed or offline, returning cache:', err);
    }

    // Return cached issues if offline
    return this.issuesCache.get(cacheKey) || [];
  }

  /**
   * Retrieves issues assigned to the authenticated user or specified username
   */
  public async getMyAssignedIssues(repoInfo: RemoteRepoInfo, currentUser?: string): Promise<IssueInfo[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:assigned:${currentUser || 'self'}`;
    const apiBase = this.getApiBaseUrl(repoInfo);

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      let username = currentUser;
      if (!username && headers['Authorization']) {
        try {
          const userRes = await this.safeFetch(`${apiBase}/user`, { headers }, 2500);
          if (userRes.ok) {
            const userJson: any = await userRes.json();
            username = userJson.login || userJson.username;
          }
        } catch {}
      }

      const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues?state=open&type=issues&limit=50`;
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawIssues: any[] = await res.json();
        const mapped = rawIssues
          .filter((raw) => !raw.pull_request)
          .map((raw) => this.mapForgejoIssue(raw, repoInfo));

        let filtered = mapped;
        if (username) {
          const lowerUser = username.toLowerCase();
          filtered = mapped.filter(
            (issue) =>
              issue.assignees.some((a) => a.name.toLowerCase() === lowerUser) ||
              issue.author.name.toLowerCase() === lowerUser
          );
        }
        this.issuesCache.set(cacheKey, filtered);
        return filtered;
      }
    } catch (err) {
      console.warn('[ForgejoProvider] getMyAssignedIssues offline, falling back to cache');
    }

    return this.issuesCache.get(cacheKey) || [];
  }

  /**
   * Retrieves detailed information for a single issue
   */
  public async getIssueDetails(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueInfo | null> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:${issueNumber}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const raw: any = await res.json();
        const mapped = this.mapForgejoIssue(raw, repoInfo);
        this.issueDetailsCache.set(cacheKey, mapped);
        return mapped;
      }
    } catch {}

    return this.issueDetailsCache.get(cacheKey) || null;
  }

  /**
   * Retrieves comments on a specific issue
   */
  public async getIssueComments(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueComment[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:${issueNumber}:comments`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}/comments`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawComments: any[] = await res.json();
        const comments = rawComments.map((raw) => ({
          id: raw.id,
          author: {
            name: raw.user?.full_name || raw.user?.login || 'User',
            email: raw.user?.email || '',
            date: new Date(raw.created_at),
            relativeTime: this.formatRelativeTime(new Date(raw.created_at)),
            avatarUrl: raw.user?.avatar_url || '',
          },
          body: raw.body || '',
          createdAt: raw.created_at,
        }));
        this.commentsCache.set(cacheKey, comments);
        return comments;
      }
    } catch {}

    return this.commentsCache.get(cacheKey) || [];
  }

  /**
   * Adds a new comment to an issue
   */
  public async createIssueComment(
    repoInfo: RemoteRepoInfo,
    issueNumber: number,
    body: string
  ): Promise<IssueComment> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}/comments`;
    const headers = await this.getAuthHeaders(repoInfo);
    const res = await this.safeFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create comment on Forgejo: HTTP ${res.status}`);
    }
    const raw: any = await res.json();
    const comment: IssueComment = {
      id: raw.id,
      author: {
        name: raw.user?.full_name || raw.user?.login || 'You',
        email: raw.user?.email || '',
        date: new Date(raw.created_at),
        relativeTime: 'just now',
        avatarUrl: raw.user?.avatar_url || '',
      },
      body: raw.body || '',
      createdAt: raw.created_at,
    };

    // Update local cache
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:${issueNumber}:comments`;
    const cached = this.commentsCache.get(cacheKey) || [];
    this.commentsCache.set(cacheKey, [...cached, comment]);

    return comment;
  }

  /**
   * Sets issue state (open or closed)
   */
  public async setIssueState(
    repoInfo: RemoteRepoInfo,
    issueNumber: number,
    state: 'open' | 'closed'
  ): Promise<void> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}`;
    const headers = await this.getAuthHeaders(repoInfo);
    const res = await this.safeFetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state }),
    });
    if (!res.ok) {
      throw new Error(`Failed to update Forgejo issue state: HTTP ${res.status}`);
    }

    // Invalidate/update local cache
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:${issueNumber}`;
    const cached = this.issueDetailsCache.get(cacheKey);
    if (cached) {
      cached.state = state;
      this.issueDetailsCache.set(cacheKey, cached);
    }
  }

  /**
   * Retrieves pull requests from Forgejo repository
   */
  public async getPullRequests(
    repoInfo: RemoteRepoInfo,
    filter: 'blocked' | 'ready' | 'mine' | 'all' = 'all'
  ): Promise<PullRequestInfo[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:prs:${filter}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/pulls?state=open&limit=50`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawPulls: any[] = await res.json();
        const prs = rawPulls.map((raw) => {
          const isDraft = raw.draft === true;
          const state = isDraft ? 'draft' : (raw.state === 'closed' ? (raw.merged ? 'merged' : 'closed') : 'open');
          const isBlocked = raw.mergeable === false;
          const isReady = !isDraft && raw.mergeable === true;
          return {
            id: raw.id,
            number: raw.number,
            title: raw.title,
            state,
            reviewStatus: 'none' as const,
            ciStatus: 'none' as const,
            author: {
              name: raw.user?.full_name || raw.user?.login || 'User',
              email: raw.user?.email || '',
              date: new Date(raw.created_at),
              relativeTime: this.formatRelativeTime(new Date(raw.created_at)),
              avatarUrl: raw.user?.avatar_url || '',
            },
            sourceBranch: raw.head?.ref || '',
            targetBranch: raw.base?.ref || '',
            url: raw.html_url || `${repoInfo.webUrl}/pulls/${raw.number}`,
            updatedAt: raw.updated_at,
            isBlocked,
            isReady,
            isPending: !isBlocked && !isReady,
            commentsCount: raw.comments,
          };
        });
        this.prsCache.set(cacheKey, prs);
        return prs;
      }
    } catch {}

    return this.prsCache.get(cacheKey) || [];
  }

  /**
   * Retrieves CI commit status checks from /api/v1/repos/{owner}/{repo}/statuses/{sha}
   */
  public async getCommitStatuses(repoInfo: RemoteRepoInfo, sha: string): Promise<ForgejoCommitStatus[]> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/statuses/${sha}`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawStatuses: any[] = await res.json();
        return rawStatuses.map((s: any) => ({
          context: s.context || 'continuous-integration',
          state: (s.status === 'success' || s.status === 'failure' || s.status === 'pending' || s.status === 'warning' || s.status === 'error')
            ? s.status
            : 'pending',
          description: s.description,
          targetUrl: s.target_url,
        }));
      }
    } catch {}

    return [];
  }

  /**
   * Retrieves labels configured in the Forgejo repo
   */
  public async getLabels(repoInfo: RemoteRepoInfo): Promise<Array<{ name: string; color: string; description?: string }>> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:labels`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/labels`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawLabels: any[] = await res.json();
        const mapped = rawLabels.map((l: any) => ({
          name: l.name,
          color: l.color ? (l.color.startsWith('#') ? l.color : `#${l.color}`) : '#6b7280',
          description: l.description,
        }));
        this.labelsCache.set(cacheKey, mapped);
        return mapped;
      }
    } catch {}

    return this.labelsCache.get(cacheKey) || [];
  }

  /**
   * Retrieves milestones configured in the Forgejo repo
   */
  public async getMilestones(
    repoInfo: RemoteRepoInfo,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<ForgejoMilestone[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:milestones:${state}`;
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/milestones?state=${state}`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawMilestones: any[] = await res.json();
        const mapped = rawMilestones.map((m: any) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          state: m.state,
          dueOn: m.due_on,
        }));
        this.milestonesCache.set(cacheKey, mapped);
        return mapped;
      }
    } catch {}

    return this.milestonesCache.get(cacheKey) || [];
  }

  /**
   * Retrieves branches from Forgejo repository
   */
  public async getBranches(repoInfo: RemoteRepoInfo): Promise<Array<{ name: string; commitHash: string }>> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/branches`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawBranches: any[] = await res.json();
        return rawBranches.map((b: any) => ({
          name: b.name,
          commitHash: b.commit?.id || '',
        }));
      }
    } catch {}

    return [];
  }

  /**
   * Retrieves tags from Forgejo repository
   */
  public async getTags(repoInfo: RemoteRepoInfo): Promise<Array<{ name: string; commitHash: string }>> {
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/repos/${repoInfo.owner}/${repoInfo.repo}/tags`;

    try {
      const headers = await this.getAuthHeaders(repoInfo);
      const res = await this.safeFetch(url, { headers });
      if (res.ok) {
        const rawTags: any[] = await res.json();
        return rawTags.map((t: any) => ({
          name: t.name,
          commitHash: t.commit?.sha || t.id || '',
        }));
      }
    } catch {}

    return [];
  }

  private mapForgejoIssue(raw: any, repoInfo: RemoteRepoInfo): IssueInfo {
    const author: GitAuthor = {
      name: raw.user?.full_name || raw.user?.login || 'Unknown',
      email: raw.user?.email || '',
      date: new Date(raw.created_at),
      relativeTime: this.formatRelativeTime(new Date(raw.created_at)),
      avatarUrl: raw.user?.avatar_url || '',
    };

    const assignees: GitAuthor[] = (raw.assignees || []).map((u: any) => ({
      name: u.full_name || u.login,
      email: u.email || '',
      date: new Date(),
      relativeTime: '',
      avatarUrl: u.avatar_url || '',
    }));

    const labels = (raw.labels || []).map((l: any) => ({
      name: l.name,
      color: l.color ? (l.color.startsWith('#') ? l.color : `#${l.color}`) : '#6b7280',
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
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
  }
}
