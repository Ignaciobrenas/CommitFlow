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

export class GitLabProvider implements RemoteProvider {
  public readonly type: RemoteProviderType = 'gitlab';
  private readonly persistence = PersistenceManager.getInstance();

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

  public async getPullRequests(
    repoInfo: RemoteRepoInfo,
    _filter: 'blocked' | 'ready' | 'mine' | 'all' = 'all'
  ): Promise<PullRequestInfo[]> {
    const projectPath = encodeURIComponent(`${repoInfo.owner}/${repoInfo.repo}`);
    const url = `https://gitlab.com/api/v4/projects/${projectPath}/merge_requests?state=opened&per_page=50`;
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const raw: any[] = await res.json();
      return raw.map((mr) => ({
        id: mr.id,
        number: mr.iid,
        title: mr.title,
        state: mr.draft ? 'draft' : 'open',
        reviewStatus: 'none',
        ciStatus: 'none',
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
        isBlocked: mr.has_conflicts === true,
        isReady: !mr.draft && !mr.has_conflicts,
        isPending: false,
        commentsCount: mr.user_notes_count,
      }));
    } catch {
      return [];
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
