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

export interface UpstreamStatus {
  behind: number;
  ahead: number;
  hasMerge: boolean;
  upstreamBranch: string;
}

export interface GraphRouteLine {
  fromLane: number;
  toLane: number;
  toHash: string;
  isMerge: boolean;
  isFork: boolean;
  color?: string;
}

export interface PassingLane {
  lane: number;
  color: string;
}

export interface IncomingLine {
  fromLane: number;
  toLane: number;
  color: string;
}

export interface GraphNode {
  commit: GitCommit;
  lane: number;
  color: string;
  lines: GraphRouteLine[];
  passingLanes?: PassingLane[];
  incomingLines?: IncomingLine[];
  isWorkingTree?: boolean;
}

export type RemoteProviderType = 'github' | 'gitlab' | 'bitbucket' | 'other';

export interface RemoteRepoInfo {
  provider: RemoteProviderType;
  owner: string;
  repo: string;
  webUrl: string;
  isPrivate: boolean;
  authConnected: boolean;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  webUrl: string;
  isPrivate?: boolean;
}

export interface GitWorktree {
  path: string;
  branch: string;
  headHash: string;
  isCurrent: boolean;
  isLocked?: boolean;
  isPrunable?: boolean;
  hasWip: boolean;
  wipFilesCount: number;
  wipModified: number;
  wipAdded: number;
  wipDeleted: number;
}

export interface PullRequestInfo {
  id: string | number;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  reviewStatus: 'approved' | 'changes_requested' | 'review_required' | 'none';
  ciStatus: 'success' | 'failure' | 'pending' | 'none';
  author: GitAuthor;
  sourceBranch: string;
  targetBranch: string;
  url: string;
  updatedAt: string;
  isBlocked: boolean;
  isReady: boolean;
  isPending: boolean;
  commentsCount?: number;
}

export interface FileCommitRevision {
  commitHash: string;
  shortHash: string;
  author: GitAuthor;
  subject: string;
  date: string;
  relativeTime: string;
  linesAdded: number;
  linesDeleted: number;
  filePath: string;
}

export interface CloudPatch {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  author: string;
  baseCommitHash: string;
  filesCount: number;
  summary: string;
  patchContent: string;
  isApplied?: boolean;
}

export type LayoutMode = 'auto' | 'bottom' | 'left' | 'right';

export type ThemeMode =
  | 'auto'
  | 'dark'
  | 'light'
  | 'cyberpunk'
  | 'dracula'
  | 'github'
  | 'neon-pink'
  | 'neon-green'
  | 'neon-blue';

export interface CommitFlowSettings {
  language: 'auto' | 'es' | 'en';
  density: 'compact' | 'comfortable' | 'spacious';
  theme: ThemeMode;
  layoutMode?: LayoutMode;
  animations: boolean;
  pageSize: number;
  inlineBlameEnabled: boolean;
  inlineBlameDelay: number;
  avatarService: 'gravatar' | 'github' | 'initials';
  autoFetch: boolean;
  fetchIntervalMinutes: number;
  notifyOnBranchMerge: boolean;
  askBeforePull: boolean;
  gitlabToken?: string;
  bitbucketToken?: string;
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

export interface GitStash {
  index: number;
  ref: string;
  hash: string;
  message: string;
  date: string;
}

export interface GraphDataPayload {
  commits: GraphNode[];
  branches: GitBranch[];
  currentBranch?: string;
  githubRepo?: GitHubRepoInfo | null;
  remoteRepo?: RemoteRepoInfo | null;
  worktrees?: GitWorktree[];
  pullRequests?: PullRequestInfo[];
  stats: RepoStats;
  personalStats?: UserPersonalStats;
  upstreamStatus?: UpstreamStatus | null;
  stashes?: GitStash[];
  cloudPatches?: CloudPatch[];
  settings?: CommitFlowSettings;
  systemLanguage?: string;
  totalCommits: number;
  maxLane?: number;
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
    | 'rebaseBranch'
    | 'mergeBranch'
    | 'abortRebase'
    | 'stashSave'
    | 'stashPop'
    | 'stashApply'
    | 'stashDrop'
    | 'openFile'
    | 'saveSettings'
    | 'openSettings'
    | 'copyToClipboard'
    | 'openExternal'
    | 'openCommit'
    | 'openDiff'
    | 'openFullPanel'
    | 'filter'
    // New Features:
    | 'requestWorktrees'
    | 'addWorktree'
    | 'removeWorktree'
    | 'openWorktree'
    | 'requestPullRequests'
    | 'checkoutPullRequest'
    | 'requestFileHistory'
    | 'openFileHistoryDiff'
    | 'createCloudPatch'
    | 'applyCloudPatch'
    | 'deleteCloudPatch'
    | 'requestCloudPatches'
    | 'setLayoutMode'
    // Developer Productivity Actions:
    | 'cherryPickCommit'
    | 'revertCommit'
    | 'createTag'
    | 'deleteTag'
    | 'undoLastCommit'
    | 'generateChangelog';
  payload?: any;
}

export interface ExtensionToWebviewMessage {
  command:
    | 'graphData'
    | 'commitFiles'
    | 'settingsUpdated'
    | 'stashesUpdated'
    | 'branchSwitched'
    | 'pullCompleted'
    | 'worktreesData'
    | 'pullRequestsData'
    | 'fileHistoryData'
    | 'cloudPatchesData'
    | 'patchCreated'
    | 'patchApplied'
    | 'changelogReady'
    | 'actionResult'
    | 'error'
    | 'loading';
  payload?: any;
}
