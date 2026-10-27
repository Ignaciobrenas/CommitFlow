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

export interface GraphNode {
  commit: GitCommit;
  lane: number;
  color: string;
  lines: GraphRouteLine[];
}

export interface GraphRouteLine {
  fromLane: number;
  toLane: number;
  toHash: string;
  isMerge: boolean;
  isFork: boolean;
}

export interface GraphDataPayload {
  commits: GraphNode[];
  branches: GitBranch[];
  currentBranch?: string;
  totalCommits: number;
  hasMore: boolean;
}

export interface WebviewToExtensionMessage {
  command:
    | 'ready'
    | 'requestData'
    | 'checkoutBranch'
    | 'copyToClipboard'
    | 'openCommit'
    | 'openDiff'
    | 'filter';
  payload?: any;
}

export interface ExtensionToWebviewMessage {
  command: 'graphData' | 'branchSwitched' | 'error' | 'loading';
  payload?: any;
}
