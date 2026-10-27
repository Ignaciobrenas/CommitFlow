export interface GitAuthor {
  name: string;
  email: string;
  date: Date;
  relativeTime: string;
  avatarUrl: string;
}

export interface GitCommitRef {
  type: 'head' | 'branch' | 'remote-branch' | 'tag';
  name: string;
  isHead: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  parentHashes: string[];
  author: GitAuthor;
  committer: GitAuthor;
  subject: string;
  body: string;
  refs: GitCommitRef[];
}

export interface GitBranch {
  name: string;
  fullName: string;
  isRemote: boolean;
  isCurrent: boolean;
  commitHash: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  lastAuthor: GitAuthor;
}

export interface GitBlameLine {
  line: number;
  commitHash: string;
  shortHash: string;
  author: GitAuthor;
  summary: string;
  previousHash?: string;
  filename: string;
}

export interface GitFileChange {
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
  path: string;
  oldPath?: string;
}

export interface CommitDetails {
  commit: GitCommit;
  files: GitFileChange[];
}

export interface ContributorStat {
  name: string;
  email: string;
  avatarUrl: string;
  commitsCount: number;
  percentage: number;
}

export interface RepoStats {
  totalCommits: number;
  totalContributors: number;
  activeBranches: number;
  topContributors: ContributorStat[];
}

export interface GraphRouteLine {
  fromLane: number;
  toLane: number;
  toHash: string;
  isMerge: boolean;
  isFork: boolean;
}

export interface GraphNode {
  commit: GitCommit;
  lane: number;
  color: string;
  lines: GraphRouteLine[];
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  webUrl: string;
}

export interface BranchParticipation {
  branchName: string;
  isCurrent: boolean;
  isRemote: boolean;
  myCommitsCount: number;
  totalCommitsCount: number;
  percentage: number;
}

export interface UserPersonalStats {
  userName: string;
  userEmail: string;
  avatarUrl: string;
  myTotalCommits: number;
  repoTotalCommits: number;
  commitPercentage: number;
  participatedBranchesCount: number;
  branches: BranchParticipation[];
}

export interface BranchifySettings {
  language: 'auto' | 'es' | 'en';
  density: 'compact' | 'comfortable' | 'spacious';
  theme: 'auto' | 'dark' | 'light';
  animations: boolean;
  pageSize: number;
  inlineBlameEnabled: boolean;
  inlineBlameDelay: number;
  avatarService: 'gravatar' | 'github' | 'initials';
  autoFetch: boolean;
  fetchIntervalMinutes: number;
  notifyOnBranchMerge: boolean;
  askBeforePull: boolean;
}

export interface GraphDataPayload {
  commits: GraphNode[];
  branches: GitBranch[];
  currentBranch?: string;
  githubRepo?: GitHubRepoInfo | null;
  stats: RepoStats;
  personalStats?: UserPersonalStats;
  settings?: BranchifySettings;
  systemLanguage?: string;
  totalCommits: number;
  hasMore: boolean;
}

export interface WebviewToExtensionMessage {
  command:
    | 'ready'
    | 'requestData'
    | 'requestCommitFiles'
    | 'checkoutBranch'
    | 'checkoutCommit'
    | 'pullBranch'
    | 'openFile'
    | 'saveSettings'
    | 'openSettings'
    | 'copyToClipboard'
    | 'openExternal'
    | 'openCommit'
    | 'openDiff'
    | 'filter';
  payload?: any;
}

export interface ExtensionToWebviewMessage {
  command:
    | 'graphData'
    | 'commitFiles'
    | 'settingsUpdated'
    | 'branchSwitched'
    | 'pullCompleted'
    | 'error'
    | 'loading';
  payload?: any;
}
