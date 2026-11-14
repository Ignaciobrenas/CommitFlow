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

export class GitLabProvider implements RemoteProvider {
  public readonly type: RemoteProviderType = 'gitlab';
  private readonly persistence = PersistenceManager.getInstance();
  private readonly prsCache = new LruCache<string, PullRequestInfo[]>(30, 120_000);
  private readonly statusesCache = new LruCache<
    string,
    Array<{ context: string; state: 'success' | 'failure' | 'pending' | 'warning' | 'error'; description?: string; targetUrl?: string }>
  >(100, 120_000);

  private getApiBaseUrl(repoInfo: RemoteRepoInfo): string {
    const cleanHost = (repoInfo.host || 'gitlab.com').trim();
    return `https://${cleanHost}/api/v4`;
  }

  public matches(_remoteUrl: string, host: string): boolean {
    const cleanHost = host.toLowerCase();
    return cleanHost === 'gitlab.com' || cleanHost.includes('gitlab');
  }

  public getWebUrl(parsed: ParsedRemote): string {
    const host = parsed.resolvedHost || parsed.host;
    return `https://${host}/${parsed.owner}/${parsed.repo}`;
  }

  public getCommitUrl(repoInfo: RemoteRepoInfo, commitHash: string): string {
    return `${repoInfo.webUrl}/-/commit/${commitHash}`;
  }

  public getBranchUrl(repoInfo: RemoteRepoInfo, branchName: string): string {
    const clean = branchName.replace(/^origin\//, '');
    return `${repoInfo.webUrl}/-/tree/${encodeURIComponent(clean)}`;
  }

  public getIssueUrl(repoInfo: RemoteRepoInfo, issueNumber: number | string): string {
    return `${repoInfo.webUrl}/-/issues/${issueNumber}`;
  }

  public getPullRequestUrl(repoInfo: RemoteRepoInfo, prNumber: number | string): string {
    return `${repoInfo.webUrl}/-/merge_requests/${prNumber}`;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token =
      (await this.persistence.getSecret('commitflow.token.gitlab')) ||
      process.env.GITLAB_TOKEN ||
      process.env.GL_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers['PRIVATE-TOKEN'] = token;
    }
    return headers;
  }

  public async getIssues(
    repoInfo: RemoteRepoInfo,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string[]; page?: number; limit?: number } = {}
  ): Promise<IssueInfo[]> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const state = options.state === 'all' ? 'all' : options.state === 'closed' ? 'closed' : 'opened';
    const limit = options.limit || 50;
    const page = options.page || 1;
    let url = `https://gitlab.com/api/v4/projects/${projectPath}/issues?state=${state}&per_page=${limit}&page=${page}`;

    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw.map((item) => this.mapGitLabIssue(item, repoInfo));
    } catch {
      return [];
    }
  }

  public async getMyAssignedIssues(repoInfo: RemoteRepoInfo, _currentUser?: string): Promise<IssueInfo[]> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    let url = `https://gitlab.com/api/v4/projects/${projectPath}/issues?state=opened&scope=assigned_to_me`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw.map((item) => this.mapGitLabIssue(item, repoInfo));
    } catch {
      return [];
    }
  }

  public async getIssueDetails(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueInfo | null> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const url = `https://gitlab.com/api/v4/projects/${projectPath}/issues/${issueNumber}`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const raw: any = await res.json();
      return this.mapGitLabIssue(raw, repoInfo);
    } catch {
      return null;
    }
  }

  public async getIssueComments(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueComment[]> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const url = `https://gitlab.com/api/v4/projects/${projectPath}/issues/${issueNumber}/notes`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const rawNotes: any[] = await res.json();
      return rawNotes
        .filter((n) => !n.system)
        .map((n) => ({
          id: n.id,
          author: {
            name: n.author?.name || n.author?.username || 'User',
            email: '',
            date: new Date(n.created_at),
            relativeTime: 'recently',
            avatarUrl: n.author?.avatar_url || '',
          },
          body: n.body || '',
          createdAt: n.created_at,
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
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/issues/${issueNumber}/notes`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitLab issue comment failed: HTTP ${res.status}`);
    }
    const n: any = await res.json();
    return {
      id: n.id,
      author: {
        name: n.author?.name || n.author?.username || 'Me',
        email: '',
        date: new Date(n.created_at || Date.now()),
        relativeTime: 'just now',
        avatarUrl: n.author?.avatar_url || '',
      },
      body: n.body || body,
      createdAt: n.created_at || new Date().toISOString(),
    };
  }

  public async setIssueState(
    repoInfo: RemoteRepoInfo,
    issueNumber: number,
    state: 'open' | 'closed'
  ): Promise<void> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/issues/${issueNumber}`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ state_event: state === 'closed' ? 'close' : 'reopen' }),
    });
    if (!res.ok) {
      throw new Error(`GitLab update issue state failed: HTTP ${res.status}`);
    }
  }

  public async getPullRequests(
    repoInfo: RemoteRepoInfo,
    filter: 'blocked' | 'ready' | 'mine' | 'all' = 'all'
  ): Promise<PullRequestInfo[]> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:mrs:${filter}`;
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/merge_requests?state=opened&per_page=50`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const raw: any[] = await res.json();
        const prs: PullRequestInfo[] = raw.map((mr) => {
          const isDraft = mr.draft === true || mr.work_in_progress === true;
          const pipelineStatus = mr.head_pipeline?.status;
          let ciStatus: PullRequestInfo['ciStatus'] = 'none';
          if (pipelineStatus === 'success') ciStatus = 'success';
          else if (pipelineStatus === 'failed' || pipelineStatus === 'canceled') ciStatus = 'failure';
          else if (pipelineStatus === 'running' || pipelineStatus === 'pending') ciStatus = 'pending';

          const reviewStatus: PullRequestInfo['reviewStatus'] =
            mr.approved === true ? 'approved' : mr.blocking_discussions_resolved === false ? 'changes_requested' : 'none';
          const isBlocked = mr.has_conflicts === true || ciStatus === 'failure' || mr.blocking_discussions_resolved === false;
          const isReady = !isDraft && !isBlocked;
          return {
            id: mr.id,
            number: mr.iid,
            title: mr.title,
            state: isDraft ? 'draft' : 'open',
            reviewStatus,
            ciStatus,
            author: {
              name: mr.author?.name || mr.author?.username || 'User',
              email: '',
              date: new Date(mr.created_at),
              relativeTime: 'recently',
              avatarUrl: mr.author?.avatar_url || '',
            },
            sourceBranch: mr.source_branch || '',
            targetBranch: mr.target_branch || '',
            url: mr.web_url || `${repoInfo.webUrl}/-/merge_requests/${mr.iid}`,
            updatedAt: mr.updated_at,
            isBlocked,
            isReady,
            isPending: !isBlocked && !isReady,
            commentsCount: mr.user_notes_count,
          };
        });
        const filtered =
          filter === 'blocked'
            ? prs.filter((p) => p.isBlocked)
            : filter === 'ready'
              ? prs.filter((p) => p.isReady)
              : prs;
        this.prsCache.set(cacheKey, filtered);
        return filtered;
      }
    } catch {}
    return this.prsCache.get(cacheKey) || [];
  }

  public async getCommitStatuses(
    repoInfo: RemoteRepoInfo,
    sha: string
  ): Promise<Array<{ context: string; state: 'success' | 'failure' | 'pending' | 'warning' | 'error'; description?: string; targetUrl?: string }>> {
    const cacheKey = `${repoInfo.owner}/${repoInfo.repo}:status:${sha}`;
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/repository/commits/${sha}/statuses`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (res.ok) {
        const raw: any[] = await res.json();
        const mapped = raw.map((s) => ({
          context: s.name || 'gitlab-ci',
          state: (s.status === 'success'
            ? 'success'
            : s.status === 'failed'
              ? 'failure'
              : s.status === 'canceled'
                ? 'error'
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
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/merge_requests/${prNumber}/notes`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw
        .filter((n) => !n.system)
        .map((n) => ({
          id: n.id,
          author: {
            name: n.author?.name || n.author?.username || 'User',
            email: '',
            date: new Date(n.created_at),
            relativeTime: 'recently',
            avatarUrl: n.author?.avatar_url || '',
          },
          body: n.body || '',
          createdAt: n.created_at,
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
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/merge_requests/${prNumber}/notes`;
    const headers = await this.getAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new Error(`GitLab MR comment failed: HTTP ${res.status}`);
    }
    const n: any = await res.json();
    return {
      id: n.id,
      author: {
        name: n.author?.name || n.author?.username || 'Me',
        email: '',
        date: new Date(n.created_at || Date.now()),
        relativeTime: 'just now',
        avatarUrl: n.author?.avatar_url || '',
      },
      body: n.body || body,
      createdAt: n.created_at || new Date().toISOString(),
    };
  }

  public async approvePullRequest(repoInfo: RemoteRepoInfo, prNumber: number): Promise<void> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const apiBase = this.getApiBaseUrl(repoInfo);
    const url = `${apiBase}/projects/${projectPath}/merge_requests/${prNumber}/approve`;
    const headers = await this.getAuthHeaders();
    const res = await fetch(url, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      throw new Error(`GitLab MR approval failed: HTTP ${res.status}`);
    }
  }

  private mapGitLabIssue(raw: any, repoInfo: RemoteRepoInfo): IssueInfo {
    const author: GitAuthor = {
      name: raw.author?.name || raw.author?.username || 'User',
      email: '',
      date: new Date(raw.created_at),
      relativeTime: 'recently',
      avatarUrl: raw.author?.avatar_url || '',
    };
    const assignees = (raw.assignees || []).map((u: any) => ({
      name: u.name || u.username,
      email: '',
      date: new Date(),
      relativeTime: '',
      avatarUrl: u.avatar_url || '',
    }));
    const labels = (raw.labels || []).map((labelName: string) => ({
      name: labelName,
      color: '#fc6d26',
    }));

    return {
      id: raw.id,
      number: raw.iid,
      title: raw.title || '',
      body: raw.description || '',
      state: raw.state === 'closed' ? 'closed' : 'open',
      author,
      assignees,
      labels,
      milestone: raw.milestone ? { title: raw.milestone.title, dueOn: raw.milestone.due_date } : undefined,
      commentsCount: raw.user_notes_count || 0,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      url: raw.web_url || `${repoInfo.webUrl}/-/issues/${raw.iid}`,
    };
  }
}
