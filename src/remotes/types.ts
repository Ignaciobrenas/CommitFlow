import { GitAuthor, PullRequestInfo } from '../git/types';

export type RemoteProviderType = 'github' | 'gitlab' | 'bitbucket' | 'forgejo' | 'other';

export interface SshHostConfig {
  host: string;
  hostName?: string;
  port?: number;
  user?: string;
  identityFile?: string;
}

export interface ParsedRemote {
  rawUrl: string;
  protocol: 'ssh' | 'https' | 'http' | 'file';
  host: string;
  port?: number;
  owner: string;
  repo: string;
  sshAlias?: string;
  resolvedHost?: string;
  resolvedPort?: number;
  identityFile?: string;
}

export interface RemoteRepoInfo {
  provider: RemoteProviderType;
  owner: string;
  repo: string;
  webUrl: string;
  isPrivate: boolean;
  authConnected: boolean;
  host?: string;
  port?: number;
  badgeType?: 'forgejo' | 'github' | 'gitlab' | 'bitbucket' | 'private';
  badgeLabel?: string;
}

export interface IssueLabel {
  name: string;
  color: string;
  description?: string;
}

export interface IssueMilestone {
  title: string;
  dueOn?: string;
  state?: string;
}

export interface IssueInfo {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  author: GitAuthor;
  assignees: GitAuthor[];
  labels: IssueLabel[];
  milestone?: IssueMilestone;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  isAssignedToMe?: boolean;
  isLinkedToBranch?: boolean;
}

export interface IssueComment {
  id: number;
  author: GitAuthor;
  body: string;
  createdAt: string;
}

export interface IssueContext {
  issue: IssueInfo;
  comments: IssueComment[];
  referencingCommits?: Array<{ hash: string; shortHash: string; subject: string; author: string }>;
  referencingPRs?: Array<{ number: number; title: string; state: string }>;
}

export interface RemoteProvider {
  readonly type: RemoteProviderType;
  matches(remoteUrl: string, host: string): Promise<boolean> | boolean;
  getWebUrl(parsed: ParsedRemote): string;
  getCommitUrl(repoInfo: RemoteRepoInfo, commitHash: string): string;
  getBranchUrl(repoInfo: RemoteRepoInfo, branchName: string): string;
  getIssueUrl(repoInfo: RemoteRepoInfo, issueNumber: number | string): string;
  getPullRequestUrl(repoInfo: RemoteRepoInfo, prNumber: number | string): string;
  
  // Issue operations
  getIssues?(repoInfo: RemoteRepoInfo, options?: { state?: 'open' | 'closed' | 'all'; labels?: string[]; page?: number; limit?: number }): Promise<IssueInfo[]>;
  getMyAssignedIssues?(repoInfo: RemoteRepoInfo, currentUser?: string): Promise<IssueInfo[]>;
  getIssueDetails?(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueInfo | null>;
  getIssueComments?(repoInfo: RemoteRepoInfo, issueNumber: number): Promise<IssueComment[]>;
  createIssueComment?(repoInfo: RemoteRepoInfo, issueNumber: number, body: string): Promise<IssueComment>;
  setIssueState?(repoInfo: RemoteRepoInfo, issueNumber: number, state: 'open' | 'closed'): Promise<void>;
  
  // Pull Request operations
  getPullRequests?(repoInfo: RemoteRepoInfo, filter?: 'blocked' | 'ready' | 'mine' | 'all'): Promise<PullRequestInfo[]>;

  // Repository metadata & CI statuses
  getRepoDetails?(repoInfo: RemoteRepoInfo): Promise<Record<string, any> | null>;
  getCommitStatuses?(repoInfo: RemoteRepoInfo, sha: string): Promise<Array<{ context: string; state: 'success' | 'failure' | 'pending' | 'warning' | 'error'; description?: string; targetUrl?: string }>>;
  getLabels?(repoInfo: RemoteRepoInfo): Promise<Array<{ name: string; color: string; description?: string }>>;
  getMilestones?(repoInfo: RemoteRepoInfo, state?: 'open' | 'closed' | 'all'): Promise<Array<{ id: number; title: string; description?: string; state: string; dueOn?: string }>>;
  getBranches?(repoInfo: RemoteRepoInfo): Promise<Array<{ name: string; commitHash: string }>>;
  getTags?(repoInfo: RemoteRepoInfo): Promise<Array<{ name: string; commitHash: string }>>;
}
