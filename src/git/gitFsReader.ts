import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export type GitHashAlgorithm = 'sha1' | 'sha256';
export type GitRefStorageFormat = 'files' | 'reftable';

export interface OfflineGitObject {
  type: 'commit' | 'tree' | 'blob' | 'tag';
  size: number;
  data: Buffer;
}

export interface OfflineCommitObject {
  hash: string;
  tree: string;
  parents: string[];
  author: string;
  committer: string;
  message: string;
}

export interface OfflineTreeEntry {
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  name: string;
  hash: string;
}

export interface OfflineGitIndexEntry {
  path: string;
  sha1: string;
  size: number;
  mtimeMs: number;
  mode: number;
  flags: number;
  assumeValid: boolean;
  stage: number;
}

export interface OfflineWorkingTreeStatus {
  stagedCount: number;
  unstagedModified: string[];
  untracked: string[];
  totalIndexEntries: number;
}

export interface OfflineGitRef {
  name: string;
  commitHash: string;
}

export interface OfflineGitRemote {
  name: string;
  url: string;
  fetch?: string;
  pushUrl?: string;
}

export interface OfflineGitBranch {
  name: string;
  commitHash: string;
  isCurrent: boolean;
  upstream?: string;
}

export interface OfflineGitWorktree {
  name: string;
  path: string;
  headBranch?: string;
  headHash?: string;
}

export interface OfflineGitSubmodule {
  name: string;
  path: string;
  fullPath: string;
  url: string;
  branch?: string;
  headCommit?: string;
  headBranch?: string;
  isDetached?: boolean;
  isDirty?: boolean;
  isInitialized: boolean;
}

export interface OfflineGitCommitEntry {
  hash: string;
  author: string;
  email: string;
  date: Date;
  action: string;
  message: string;
}

export interface OfflineOperationState {
  isMerging: boolean;
  mergeHead?: string;
  isRebasing: boolean;
  rebaseHeadName?: string;
  rebaseOnto?: string;
  rebaseStep?: number;
  rebaseTotalSteps?: number;
  isCherryPicking: boolean;
  cherryPickHead?: string;
  isReverting: boolean;
  revertHead?: string;
  isBisecting: boolean;
  bisectStart?: string;
  bisectExpectedRev?: string;
  bisectBad?: string;
  bisectGood?: string[];
}

export interface OfflineRepoState {
  isRepo: boolean;
  gitDir: string;
  commonDir: string;
  head: {
    isDetached: boolean;
    branch?: string;
    commitHash: string;
  };
  branches: OfflineGitBranch[];
  tags: OfflineGitRef[];
  remotes: OfflineGitRemote[];
  stashes: Array<{ index: number; commitHash: string; message: string }>;
  worktrees: OfflineGitWorktree[];
  submodules: OfflineGitSubmodule[];
  operationState: OfflineOperationState;
  lastCommitMessage?: string;
  recentCommitsFromReflog: OfflineGitCommitEntry[];
  userName?: string;
  userEmail?: string;
  objectFormat?: GitHashAlgorithm;
  refStorage?: GitRefStorageFormat;
}

/**
 * Direct filesystem reader for the .git directory.
 * Operates 100% offline with zero external process execution and zero network dependency.
 */
export class GitFsReader {
  private static instance: GitFsReader;

  public static getInstance(): GitFsReader {
    if (!GitFsReader.instance) {
      GitFsReader.instance = new GitFsReader();
    }
    return GitFsReader.instance;
  }

  /**
   * Resolves the actual .git directory, handling normal repos, gitdir files (submodules/worktrees),
   * and linked worktrees.
   */
  public resolveGitDir(repoPath: string): { gitDir: string; commonDir: string } | null {
    try {
      const gitPath = path.join(repoPath, '.git');
      if (!fs.existsSync(gitPath)) {
        return null;
      }

      const stat = fs.statSync(gitPath);
      if (stat.isDirectory()) {
        const commonDirPath = path.join(gitPath, 'commondir');
        let commonDir = gitPath;
        if (fs.existsSync(commonDirPath)) {
          const relCommon = fs.readFileSync(commonDirPath, 'utf8').trim();
          commonDir = path.resolve(gitPath, relCommon);
        }
        return { gitDir: gitPath, commonDir };
      } else if (stat.isFile()) {
        // e.g. "gitdir: ../../.git/modules/my-submodule" or linked worktree
        const content = fs.readFileSync(gitPath, 'utf8').trim();
        const match = content.match(/^gitdir:\s*(.+)$/i);
        if (match) {
          const resolvedGitDir = path.resolve(repoPath, match[1].trim());
          const commonDirPath = path.join(resolvedGitDir, 'commondir');
          let commonDir = resolvedGitDir;
          if (fs.existsSync(commonDirPath)) {
            const relCommon = fs.readFileSync(commonDirPath, 'utf8').trim();
            commonDir = path.resolve(resolvedGitDir, relCommon);
          }
          return { gitDir: resolvedGitDir, commonDir };
        }
      }
    } catch {
      // Ignore filesystem read errors
    }
    return null;
  }

  /**
   * Reads the comprehensive offline state of the local git repository directly from disk.
   */
  public readOfflineRepoState(repoPath: string): OfflineRepoState | null {
    const resolved = this.resolveGitDir(repoPath);
    if (!resolved) {
      return null;
    }

    const { gitDir, commonDir } = resolved;
    const packedRefs = this.readPackedRefs(commonDir);
    const headInfo = this.readHead(gitDir, commonDir, packedRefs);
    const configInfo = this.readConfig(commonDir);
    const localBranches = this.readLocalBranches(commonDir, packedRefs, headInfo.branch, configInfo.branchUpstreams);
    const tags = this.readTags(commonDir, packedRefs);
    const stashes = this.readStashes(commonDir);
    const worktrees = this.readWorktrees(commonDir, repoPath);
    const submodules = this.readSubmodules(repoPath, commonDir);
    const operationState = this.readOperationState(gitDir);
    const lastCommitMessage = this.readLastCommitMessage(gitDir);
    const recentCommitsFromReflog = this.readReflog(gitDir, 50);

    return {
      isRepo: true,
      gitDir,
      commonDir,
      head: headInfo,
      branches: localBranches,
      tags,
      remotes: configInfo.remotes,
      stashes,
      worktrees,
      submodules,
      operationState,
      lastCommitMessage,
      recentCommitsFromReflog,
      userName: configInfo.userName,
      userEmail: configInfo.userEmail,
      objectFormat: configInfo.objectFormat || this.detectHashAlgorithm(commonDir),
      refStorage: configInfo.refStorage || (this.detectReftable(commonDir).isReftable ? 'reftable' : 'files'),
    };
  }

  /**
   * Reads .git/HEAD to determine current branch or detached commit SHA.
   */
  public readHead(
    gitDir: string,
    commonDir: string,
    packedRefs: Map<string, string>
  ): { isDetached: boolean; branch?: string; commitHash: string } {
    try {
      const headFile = path.join(gitDir, 'HEAD');
      if (!fs.existsSync(headFile)) {
        return { isDetached: false, commitHash: '' };
      }

      const content = fs.readFileSync(headFile, 'utf8').trim();
      if (content.startsWith('ref:')) {
        const refPath = content.replace(/^ref:\s*/, '').trim();
        // Prevent path traversal in symbolic ref
        if (refPath.includes('..') || path.isAbsolute(refPath)) {
          return { isDetached: false, commitHash: '' };
        }
        const branchName = refPath.replace(/^refs\/heads\//, '');
        let commitHash = '';

        // Check loose ref in commonDir
        const looseRef = path.join(commonDir, refPath);
        if (fs.existsSync(looseRef)) {
          commitHash = fs.readFileSync(looseRef, 'utf8').trim();
        } else if (packedRefs.has(refPath)) {
          commitHash = packedRefs.get(refPath) || '';
        }

        return {
          isDetached: false,
          branch: branchName,
          commitHash,
        };
      } else {
        // Direct commit SHA (detached HEAD)
        return {
          isDetached: true,
          commitHash: content,
        };
      }
    } catch {
      return { isDetached: false, commitHash: '' };
    }
  }

  /**
   * Reads .git/packed-refs file into a map of ref -> SHA
   */
  public readPackedRefs(commonDir: string): Map<string, string> {
    const map = new Map<string, string>();
    try {
      const packedFile = path.join(commonDir, 'packed-refs');
      if (!fs.existsSync(packedFile)) {
        return map;
      }

      const lines = fs.readFileSync(packedFile, 'utf8').split(/\r?\n/);
      let lastRef = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        if (trimmed.startsWith('^')) {
          // Peeled tag object reference
          const peeledSha = trimmed.slice(1).trim();
          if (lastRef) {
            map.set(`${lastRef}^{}`, peeledSha);
          }
          continue;
        }

        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const sha = parts[0];
          const ref = parts[1];
          map.set(ref, sha);
          lastRef = ref;
        }
      }
    } catch {}
    return map;
  }

  /**
   * Reads .git/config to extract remotes, upstream tracking, user info, and repository extensions.
   */
  public readConfig(commonDir: string): {
    remotes: OfflineGitRemote[];
    branchUpstreams: Map<string, string>;
    userName?: string;
    userEmail?: string;
    objectFormat?: GitHashAlgorithm;
    refStorage?: GitRefStorageFormat;
  } {
    const remotesMap = new Map<string, OfflineGitRemote>();
    const branchUpstreams = new Map<string, string>();
    let userName: string | undefined;
    let userEmail: string | undefined;
    let objectFormat: GitHashAlgorithm | undefined;
    let refStorage: GitRefStorageFormat | undefined;

    try {
      const configFile = path.join(commonDir, 'config');
      if (!fs.existsSync(configFile)) {
        return { remotes: [], branchUpstreams };
      }

      const lines = fs.readFileSync(configFile, 'utf8').split(/\r?\n/);
      let currentSection: { type: string; name?: string } | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
          continue;
        }

        const sectionMatch = trimmed.match(/^\[([a-zA-Z0-9_\-]+)(?:\s+"([^"]+)")?\]$/);
        if (sectionMatch) {
          currentSection = {
            type: sectionMatch[1].toLowerCase(),
            name: sectionMatch[2],
          };
          if (currentSection.type === 'remote' && currentSection.name) {
            if (!remotesMap.has(currentSection.name)) {
              remotesMap.set(currentSection.name, {
                name: currentSection.name,
                url: '',
              });
            }
          }
          continue;
        }

        if (!currentSection) continue;

        const kvMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(.*)$/);
        if (!kvMatch) continue;

        const key = kvMatch[1].toLowerCase();
        const value = kvMatch[2].trim();

        if (currentSection.type === 'remote' && currentSection.name) {
          const remote = remotesMap.get(currentSection.name)!;
          if (key === 'url') remote.url = value;
          else if (key === 'fetch') remote.fetch = value;
          else if (key === 'pushurl') remote.pushUrl = value;
        } else if (currentSection.type === 'branch' && currentSection.name) {
          if (key === 'remote') {
            const current = branchUpstreams.get(currentSection.name) || '';
            branchUpstreams.set(currentSection.name, `${value}/${current.split('/')[1] || ''}`);
          } else if (key === 'merge') {
            const cleanMerge = value.replace(/^refs\/heads\//, '');
            const current = branchUpstreams.get(currentSection.name) || '';
            const remoteName = current.split('/')[0] || 'origin';
            branchUpstreams.set(currentSection.name, `${remoteName}/${cleanMerge}`);
          }
        } else if (currentSection.type === 'user') {
          if (key === 'name') userName = value;
          else if (key === 'email') userEmail = value;
        } else if (currentSection.type === 'extensions') {
          if (key === 'objectformat' && (value === 'sha1' || value === 'sha256')) {
            objectFormat = value;
          } else if (key === 'refstorage' && (value === 'files' || value === 'reftable')) {
            refStorage = value;
          }
        }
      }
    } catch {}

    return {
      remotes: Array.from(remotesMap.values()),
      branchUpstreams,
      userName,
      userEmail,
      objectFormat,
      refStorage,
    };
  }

  /**
   * Validates 40-char SHA-1 or 64-char SHA-256 Git object identifiers.
   */
  public isValidObjectId(oid: string): boolean {
    return /^[0-9a-f]{40}$|^[0-9a-f]{64}$/i.test(oid.trim());
  }

  /**
   * Detects repository hash algorithm ('sha1' or 'sha256') from config or loose refs.
   */
  public detectHashAlgorithm(commonDir: string): GitHashAlgorithm {
    const cfg = this.readConfig(commonDir);
    if (cfg.objectFormat) return cfg.objectFormat;
    try {
      const refsHeads = path.join(commonDir, 'refs', 'heads');
      if (fs.existsSync(refsHeads)) {
        const refs = this.readLooseRefsRecursively(refsHeads, refsHeads);
        if (refs.some((r) => r.commitHash.length === 64)) return 'sha256';
      }
      const headFile = path.join(commonDir, 'HEAD');
      if (fs.existsSync(headFile)) {
        const headContent = fs.readFileSync(headFile, 'utf8').trim();
        if (/^[0-9a-f]{64}$/i.test(headContent)) return 'sha256';
      }
    } catch {}
    return 'sha1';
  }

  /**
   * Detects whether a repository uses Git 2.45+ reftable storage instead of loose refs.
   */
  public detectReftable(commonDir: string): {
    isReftable: boolean;
    tablesListPath?: string;
    tablesCount: number;
  } {
    const cfg = this.readConfig(commonDir);
    const tablesListPath = path.join(commonDir, 'reftable', 'tables.list');
    const hasTablesList = fs.existsSync(tablesListPath);
    let tablesCount = 0;
    if (hasTablesList) {
      try {
        tablesCount = fs.readFileSync(tablesListPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).length;
      } catch {}
    }
    const isReftable = cfg.refStorage === 'reftable' || hasTablesList;
    return {
      isReftable,
      tablesListPath: hasTablesList ? tablesListPath : undefined,
      tablesCount,
    };
  }

  /**
   * Recursively reads loose refs inside a directory
   */
  private readLooseRefsRecursively(dir: string, baseDir: string): OfflineGitRef[] {
    const results: OfflineGitRef[] = [];
    if (!fs.existsSync(dir)) return results;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.readLooseRefsRecursively(fullPath, baseDir));
        } else if (entry.isFile() && !entry.isSymbolicLink()) {
          try {
            const sha = fs.readFileSync(fullPath, 'utf8').trim();
            if (this.isValidObjectId(sha)) {
              const relName = path.relative(baseDir, fullPath).replace(/\\/g, '/');
              results.push({ name: relName, commitHash: sha });
            }
          } catch {}
        }
      }
    } catch {}

    return results;
  }

  /**
   * Reads local branches from refs/heads and packed-refs
   */
  public readLocalBranches(
    commonDir: string,
    packedRefs: Map<string, string>,
    currentBranch?: string,
    upstreams: Map<string, string> = new Map()
  ): OfflineGitBranch[] {
    const branchMap = new Map<string, OfflineGitBranch>();
    const headsDir = path.join(commonDir, 'refs', 'heads');

    // 1. Loose refs
    const loose = this.readLooseRefsRecursively(headsDir, headsDir);
    for (const ref of loose) {
      branchMap.set(ref.name, {
        name: ref.name,
        commitHash: ref.commitHash,
        isCurrent: ref.name === currentBranch,
        upstream: upstreams.get(ref.name),
      });
    }

    // 2. Packed refs
    for (const [refName, sha] of packedRefs.entries()) {
      if (refName.startsWith('refs/heads/')) {
        const name = refName.replace(/^refs\/heads\//, '');
        if (!branchMap.has(name)) {
          branchMap.set(name, {
            name,
            commitHash: sha,
            isCurrent: name === currentBranch,
            upstream: upstreams.get(name),
          });
        }
      }
    }

    return Array.from(branchMap.values());
  }

  /**
   * Reads tags from refs/tags and packed-refs
   */
  public readTags(commonDir: string, packedRefs: Map<string, string>): OfflineGitRef[] {
    const tagMap = new Map<string, OfflineGitRef>();
    const tagsDir = path.join(commonDir, 'refs', 'tags');

    const loose = this.readLooseRefsRecursively(tagsDir, tagsDir);
    for (const ref of loose) {
      tagMap.set(ref.name, ref);
    }

    for (const [refName, sha] of packedRefs.entries()) {
      if (refName.startsWith('refs/tags/') && !refName.endsWith('^{}')) {
        const name = refName.replace(/^refs\/tags\//, '');
        if (!tagMap.has(name)) {
          // If peeled exists, prefer peeled commit SHA
          const peeled = packedRefs.get(`${refName}^{}`);
          tagMap.set(name, {
            name,
            commitHash: peeled || sha,
          });
        }
      }
    }

    return Array.from(tagMap.values());
  }

  /**
   * Reads local stashes from .git/logs/refs/stash
   */
  public readStashes(commonDir: string): Array<{ index: number; commitHash: string; message: string }> {
    const stashes: Array<{ index: number; commitHash: string; message: string }> = [];
    try {
      const stashLogFile = path.join(commonDir, 'logs', 'refs', 'stash');
      if (!fs.existsSync(stashLogFile)) {
        return stashes;
      }

      const lines = fs.readFileSync(stashLogFile, 'utf8').trim().split(/\r?\n/).reverse();
      lines.forEach((line, idx) => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const header = parts[0].split(/\s+/);
          const newSha = header[1] || '';
          const message = parts[1] || `stash@{${idx}}`;
          stashes.push({
            index: idx,
            commitHash: newSha,
            message,
          });
        }
      });
    } catch {}
    return stashes;
  }

  /**
   * Reads active worktrees from .git/worktrees
   */
  public readWorktrees(commonDir: string, mainRepoPath: string): OfflineGitWorktree[] {
    const results: OfflineGitWorktree[] = [
      {
        name: path.basename(mainRepoPath),
        path: mainRepoPath,
      },
    ];

    try {
      const worktreesDir = path.join(commonDir, 'worktrees');
      if (!fs.existsSync(worktreesDir)) {
        return results;
      }

      const entries = fs.readdirSync(worktreesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const wtDir = path.join(worktreesDir, entry.name);
        const gitdirFile = path.join(wtDir, 'gitdir');
        const headFile = path.join(wtDir, 'HEAD');

        let wtPath = '';
        if (fs.existsSync(gitdirFile)) {
          const content = fs.readFileSync(gitdirFile, 'utf8').trim();
          wtPath = content.replace(/\/\.git$/, '').replace(/\\\.git$/, '');
        }

        let headBranch: string | undefined;
        let headHash: string | undefined;

        if (fs.existsSync(headFile)) {
          const headContent = fs.readFileSync(headFile, 'utf8').trim();
          if (headContent.startsWith('ref:')) {
            headBranch = headContent.replace(/^ref:\s*refs\/heads\//, '').trim();
          } else {
            headHash = headContent;
          }
        }

        if (wtPath) {
          results.push({
            name: entry.name,
            path: wtPath,
            headBranch,
            headHash,
          });
        }
      }
    } catch {}

    return results;
  }

  /**
   * Reads .gitmodules and detects active/nested git submodules directly from the filesystem.
   * Runs 100% offline with zero external processes.
   */
  public readSubmodules(
    repoPath: string,
    commonDir: string,
    depth = 0,
    maxDepth = 4,
    visited: Set<string> = new Set()
  ): OfflineGitSubmodule[] {
    const submodules: OfflineGitSubmodule[] = [];
    if (depth > maxDepth) return submodules;
    try {
      const normalizedRoot = path.resolve(repoPath);
      if (visited.has(normalizedRoot)) return submodules;
      visited.add(normalizedRoot);

      const gitmodulesPath = path.join(repoPath, '.gitmodules');
      if (!fs.existsSync(gitmodulesPath)) {
        // Also check if .git/modules exists even without .gitmodules
        const modulesDir = path.join(commonDir, 'modules');
        if (fs.existsSync(modulesDir)) {
          this.scanModulesDir(modulesDir, repoPath, submodules);
        }
        return submodules;
      }

      const content = fs.readFileSync(gitmodulesPath, 'utf8');
      const lines = content.split(/\r?\n/);
      let currentSub: { name: string; path?: string; url?: string; branch?: string } | null = null;

      const pushAndRecurse = (sub: { name: string; path: string; url: string; branch?: string }) => {
        const enriched = this.enrichSubmoduleInfo(repoPath, commonDir, sub);
        submodules.push(enriched);
        if (enriched.isInitialized && fs.existsSync(enriched.fullPath)) {
          const nestedResolved = this.resolveGitDir(enriched.fullPath);
          if (nestedResolved) {
            const nested = this.readSubmodules(enriched.fullPath, nestedResolved.commonDir, depth + 1, maxDepth, visited);
            for (const child of nested) {
              child.name = `${enriched.name}/${child.name}`;
              child.path = path.posix.join(enriched.path.replace(/\\/g, '/'), child.path.replace(/\\/g, '/'));
              submodules.push(child);
            }
          }
        }
      };

      for (const line of lines) {
        const trimmed = line.trim();
        const sectionMatch = trimmed.match(/^\[submodule\s+"(.+)"\]$/i);
        if (sectionMatch) {
          if (currentSub && currentSub.path && currentSub.url) {
            pushAndRecurse(currentSub as { name: string; path: string; url: string; branch?: string });
          }
          currentSub = { name: sectionMatch[1] };
          continue;
        }

        if (!currentSub) continue;

        const kvMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*(.*)$/);
        if (kvMatch) {
          const key = kvMatch[1].toLowerCase();
          const val = kvMatch[2].trim();
          if (key === 'path') {
            currentSub.path = val;
          } else if (key === 'url') {
            currentSub.url = val;
          } else if (key === 'branch') {
            currentSub.branch = val;
          }
        }
      }

      if (currentSub && currentSub.path && currentSub.url) {
        pushAndRecurse(currentSub as { name: string; path: string; url: string; branch?: string });
      }
    } catch {}

    return submodules;
  }

  /**
   * Enriches submodule information by inspecting the submodule folder and .git reference.
   */
  private enrichSubmoduleInfo(
    repoPath: string,
    commonDir: string,
    sub: { name: string; path: string; url: string; branch?: string }
  ): OfflineGitSubmodule {
    const fullPath = path.resolve(repoPath, sub.path);
    let isInitialized = false;
    let headCommit: string | undefined;
    let headBranch: string | undefined;
    let isDetached: boolean | undefined;
    let isDirty = false;

    try {
      if (fs.existsSync(fullPath)) {
        const resolved = this.resolveGitDir(fullPath);
        if (resolved) {
          isInitialized = true;
          const packedRefs = this.readPackedRefs(resolved.commonDir);
          const head = this.readHead(resolved.gitDir, resolved.commonDir, packedRefs);
          headCommit = head.commitHash;
          headBranch = head.branch;
          isDetached = head.isDetached;

          // Check offline working tree cleanliness via .git/index
          const status = this.computeOfflineWorkingTreeStatus(fullPath, resolved.gitDir, resolved.commonDir);
          if (status.unstagedModified.length > 0) {
            isDirty = true;
          }
        }
      }

      if (!isInitialized) {
        const moduleGitDir = path.join(commonDir, 'modules', sub.name);
        if (fs.existsSync(moduleGitDir)) {
          isInitialized = true;
          const packedRefs = this.readPackedRefs(moduleGitDir);
          const head = this.readHead(moduleGitDir, moduleGitDir, packedRefs);
          headCommit = head.commitHash;
          headBranch = head.branch;
          isDetached = head.isDetached;
        }
      }
    } catch {}

    return {
      name: sub.name,
      path: sub.path,
      fullPath,
      url: sub.url,
      branch: sub.branch,
      headCommit,
      headBranch,
      isDetached,
      isDirty,
      isInitialized,
    };
  }

  /**
   * Scans .git/modules recursively when .gitmodules is absent or detached.
   */
  private scanModulesDir(modulesDir: string, repoPath: string, acc: OfflineGitSubmodule[], prefix = ''): void {
    try {
      if (!fs.existsSync(modulesDir)) return;
      const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(modulesDir, entry.name);
        const headPath = path.join(entryPath, 'HEAD');
        const relName = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (fs.existsSync(headPath)) {
          const configPath = path.join(entryPath, 'config');
          let url = '';
          if (fs.existsSync(configPath)) {
            const configText = fs.readFileSync(configPath, 'utf8');
            const urlMatch = configText.match(/url\s*=\s*(.+)/);
            if (urlMatch) url = urlMatch[1].trim();
          }
          acc.push(this.enrichSubmoduleInfo(repoPath, modulesDir, {
            name: relName,
            path: relName,
            url: url || `local://${relName}`,
          }));
        } else {
          this.scanModulesDir(entryPath, repoPath, acc, relName);
        }
      }
    } catch {}
  }

  /**
   * Reads in-flight operation state (merge, rebase, cherry-pick, revert, bisect)
   */
  public readOperationState(gitDir: string): OfflineOperationState {
    const state: OfflineOperationState = {
      isMerging: false,
      isRebasing: false,
      isCherryPicking: false,
      isReverting: false,
      isBisecting: false,
    };

    try {
      // 1. Merge
      const mergeHead = path.join(gitDir, 'MERGE_HEAD');
      if (fs.existsSync(mergeHead)) {
        state.isMerging = true;
        state.mergeHead = fs.readFileSync(mergeHead, 'utf8').trim();
      }

      // 2. Cherry Pick
      const cpHead = path.join(gitDir, 'CHERRY_PICK_HEAD');
      if (fs.existsSync(cpHead)) {
        state.isCherryPicking = true;
        state.cherryPickHead = fs.readFileSync(cpHead, 'utf8').trim();
      }

      // 3. Revert
      const revHead = path.join(gitDir, 'REVERT_HEAD');
      if (fs.existsSync(revHead)) {
        state.isReverting = true;
        state.revertHead = fs.readFileSync(revHead, 'utf8').trim();
      }

      // 4. Bisect
      const bisectStart = path.join(gitDir, 'BISECT_START');
      if (fs.existsSync(bisectStart)) {
        state.isBisecting = true;
        try {
          state.bisectStart = fs.readFileSync(bisectStart, 'utf8').trim();
        } catch {}

        const expectedRevFile = path.join(gitDir, 'BISECT_EXPECTED_REV');
        if (fs.existsSync(expectedRevFile)) {
          try {
            state.bisectExpectedRev = fs.readFileSync(expectedRevFile, 'utf8').trim();
          } catch {}
        }

        const badRefFile = path.join(gitDir, 'refs', 'bisect', 'bad');
        if (fs.existsSync(badRefFile)) {
          try {
            state.bisectBad = fs.readFileSync(badRefFile, 'utf8').trim();
          } catch {}
        }

        const bisectRefsDir = path.join(gitDir, 'refs', 'bisect');
        if (fs.existsSync(bisectRefsDir)) {
          try {
            const files = fs.readdirSync(bisectRefsDir);
            const goodRefs: string[] = [];
            for (const f of files) {
              if (f.startsWith('good-')) {
                try {
                  goodRefs.push(fs.readFileSync(path.join(bisectRefsDir, f), 'utf8').trim());
                } catch {}
              }
            }
            if (goodRefs.length > 0) state.bisectGood = goodRefs;
          } catch {}
        }
      }

      // 5. Rebase (rebase-merge or rebase-apply)
      const rebaseMerge = path.join(gitDir, 'rebase-merge');
      const rebaseApply = path.join(gitDir, 'rebase-apply');
      const rebaseDir = fs.existsSync(rebaseMerge) ? rebaseMerge : fs.existsSync(rebaseApply) ? rebaseApply : null;

      if (rebaseDir) {
        state.isRebasing = true;
        const headNameFile = path.join(rebaseDir, 'head-name');
        const ontoFile = path.join(rebaseDir, 'onto');
        const msgNumFile = path.join(rebaseDir, 'msgnum');
        const endFile = path.join(rebaseDir, 'end');

        if (fs.existsSync(headNameFile)) {
          state.rebaseHeadName = fs.readFileSync(headNameFile, 'utf8').trim().replace(/^refs\/heads\//, '');
        }
        if (fs.existsSync(ontoFile)) {
          state.rebaseOnto = fs.readFileSync(ontoFile, 'utf8').trim();
        }
        if (fs.existsSync(msgNumFile)) {
          state.rebaseStep = parseInt(fs.readFileSync(msgNumFile, 'utf8').trim(), 10) || undefined;
        }
        if (fs.existsSync(endFile)) {
          state.rebaseTotalSteps = parseInt(fs.readFileSync(endFile, 'utf8').trim(), 10) || undefined;
        }
      }
    } catch {}

    return state;
  }

  /**
   * Reads .git/COMMIT_EDITMSG
   */
  public readLastCommitMessage(gitDir: string): string | undefined {
    try {
      const file = path.join(gitDir, 'COMMIT_EDITMSG');
      if (fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf8').trim();
      }
    } catch {}
    return undefined;
  }

  /**
   * Reads recent commits directly from .git/logs/HEAD reflog
   */
  public readReflog(gitDir: string, limit = 50): OfflineGitCommitEntry[] {
    const entries: OfflineGitCommitEntry[] = [];
    try {
      const logFile = path.join(gitDir, 'logs', 'HEAD');
      if (!fs.existsSync(logFile)) {
        return entries;
      }

      const lines = fs.readFileSync(logFile, 'utf8').trim().split(/\r?\n/).reverse();
      for (const line of lines.slice(0, limit)) {
        const parts = line.split('\t');
        if (parts.length < 2) continue;

        const header = parts[0];
        const actionAndMsg = parts[1];

        // Format: <old-sha> <new-sha> <name> <<email>> <timestamp> <tz> (SHA-1 40-char or SHA-256 64-char)
        const match = header.match(/^([0-9a-f]{40}(?:[0-9a-f]{24})?)\s+([0-9a-f]{40}(?:[0-9a-f]{24})?)\s+([^<]+)<([^>]+)>\s+(\d+)\s+([+\-\d]+)$/i);
        if (match) {
          const newSha = match[2];
          const author = match[3].trim();
          const email = match[4].trim();
          const timestamp = parseInt(match[5], 10) * 1000;
          const date = new Date(timestamp);

          const colonIdx = actionAndMsg.indexOf(':');
          const action = colonIdx !== -1 ? actionAndMsg.slice(0, colonIdx).trim() : 'commit';
          const message = colonIdx !== -1 ? actionAndMsg.slice(colonIdx + 1).trim() : actionAndMsg.trim();

          entries.push({
            hash: newSha,
            author,
            email,
            date,
            action,
            message,
          });
        }
      }
    } catch {}
    return entries;
  }

  // --------------------------------------------------------------------------
  // Binary Git Object & Index Readers (Loose Objects, Packfiles, Delta, DIRC)
  // --------------------------------------------------------------------------

  /**
   * Reads and decompresses a loose Git object from .git/objects/xx/yyyy...
   */
  public readLooseObject(commonDir: string, oid: string): OfflineGitObject | null {
    const cleanOid = oid.trim().toLowerCase();
    if (!this.isValidObjectId(cleanOid)) return null;

    try {
      const objPath = path.join(commonDir, 'objects', cleanOid.slice(0, 2), cleanOid.slice(2));
      if (!fs.existsSync(objPath)) return null;

      const compressed = fs.readFileSync(objPath);
      const raw = zlib.inflateSync(compressed);
      const nullIdx = raw.indexOf(0);
      if (nullIdx === -1) return null;

      const header = raw.subarray(0, nullIdx).toString('utf8');
      const spaceIdx = header.indexOf(' ');
      if (spaceIdx === -1) return null;

      const type = header.slice(0, spaceIdx) as OfflineGitObject['type'];
      const size = parseInt(header.slice(spaceIdx + 1), 10) || 0;
      const data = raw.subarray(nullIdx + 1);
      return { type, size, data };
    } catch {
      return null;
    }
  }

  /**
   * Decodes Git binary delta stream (OFS_DELTA / REF_DELTA) against base buffer.
   */
  public applyGitDelta(base: Buffer, delta: Buffer): Buffer {
    let pos = 0;

    const readLebVarint = (): number => {
      let result = 0;
      let shift = 0;
      while (pos < delta.length) {
        const b = delta[pos++];
        result |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
      }
      return result >>> 0;
    };

    const baseSize = readLebVarint();
    if (base.length !== baseSize) {
      throw new Error(`Delta base size mismatch: expected ${baseSize}, got ${base.length}`);
    }
    const resultSize = readLebVarint();
    const chunks: Buffer[] = [];

    while (pos < delta.length) {
      const cmd = delta[pos++];
      if (cmd & 0x80) {
        let copyOffset = 0;
        let copySize = 0;
        if (cmd & 0x01) copyOffset |= delta[pos++];
        if (cmd & 0x02) copyOffset |= delta[pos++] << 8;
        if (cmd & 0x04) copyOffset |= delta[pos++] << 16;
        if (cmd & 0x08) copyOffset |= delta[pos++] << 24;
        if (cmd & 0x10) copySize |= delta[pos++];
        if (cmd & 0x20) copySize |= delta[pos++] << 8;
        if (cmd & 0x40) copySize |= delta[pos++] << 16;
        if (copySize === 0) copySize = 0x10000;
        chunks.push(base.subarray(copyOffset >>> 0, (copyOffset >>> 0) + copySize));
      } else if (cmd > 0) {
        chunks.push(delta.subarray(pos, pos + cmd));
        pos += cmd;
      } else {
        throw new Error('Unexpected delta opcode 0x00');
      }
    }

    const result = Buffer.concat(chunks);
    if (result.length !== resultSize) {
      throw new Error(`Delta result size mismatch: expected ${resultSize}, got ${result.length}`);
    }
    return result;
  }

  /**
   * Looks up a Git object offset in a v2 packfile index (.idx) using binary search.
   */
  public readPackIndexV2(
    idxBuffer: Buffer,
    oid: string,
    hashLenBytes = 20
  ): { offset: number } | null {
    const cleanOid = oid.trim().toLowerCase();
    if (cleanOid.length !== hashLenBytes * 2 || idxBuffer.length < 1032) {
      return null;
    }

    // Verify magic 0xff744f63 and version 2
    if (
      idxBuffer.readUInt32BE(0) !== 0xff744f63 ||
      idxBuffer.readUInt32BE(4) !== 2
    ) {
      return null;
    }

    const targetBuf = Buffer.from(cleanOid, 'hex');
    const firstByte = targetBuf[0];
    const startIdx = firstByte === 0 ? 0 : idxBuffer.readUInt32BE(8 + (firstByte - 1) * 4);
    const endIdx = idxBuffer.readUInt32BE(8 + firstByte * 4);
    if (startIdx >= endIdx) return null;

    const totalObjects = idxBuffer.readUInt32BE(8 + 255 * 4);
    const oidTableStart = 8 + 256 * 4;
    const offsetsTableStart = oidTableStart + totalObjects * (hashLenBytes + 4);
    const largeOffsetsStart = offsetsTableStart + totalObjects * 4;

    let lo = startIdx;
    let hi = endIdx - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const entryStart = oidTableStart + mid * hashLenBytes;
      const cmp = Buffer.compare(targetBuf, idxBuffer.subarray(entryStart, entryStart + hashLenBytes));
      if (cmp === 0) {
        const rawOffset = idxBuffer.readUInt32BE(offsetsTableStart + mid * 4);
        if ((rawOffset & 0x80000000) === 0) {
          return { offset: rawOffset };
        }
        const largeIdx = rawOffset & 0x7fffffff;
        const hiWord = idxBuffer.readUInt32BE(largeOffsetsStart + largeIdx * 8);
        const loWord = idxBuffer.readUInt32BE(largeOffsetsStart + largeIdx * 8 + 4);
        return { offset: hiWord * 0x100000000 + loWord };
      }
      if (cmp < 0) hi = mid - 1;
      else lo = mid + 1;
    }

    return null;
  }

  /**
   * Reads a single object at byte offset inside a Git .pack file (supports OFS_DELTA and REF_DELTA).
   */
  public readPackObject(
    packBuffer: Buffer,
    offset: number,
    hashLenBytes = 20,
    resolveRef?: (oid: string) => OfflineGitObject | null,
    depth = 0
  ): OfflineGitObject | null {
    if (depth > 64 || offset < 12 || offset >= packBuffer.length) return null;

    let pos = offset;
    let byte = packBuffer[pos++];
    const typeId = (byte >> 4) & 0x07;
    let size = byte & 0x0f;
    let shift = 4;
    while (byte & 0x80) {
      byte = packBuffer[pos++];
      size += (byte & 0x7f) * Math.pow(2, shift);
      shift += 7;
    }

    const typeMap: Record<number, OfflineGitObject['type']> = {
      1: 'commit',
      2: 'tree',
      3: 'blob',
      4: 'tag',
    };

    try {
      if (typeMap[typeId]) {
        const data = zlib.inflateSync(packBuffer.subarray(pos));
        return { type: typeMap[typeId], size: size || data.length, data };
      }

      if (typeId === 6) {
        // OFS_DELTA
        let ofsByte = packBuffer[pos++];
        let relOffset = ofsByte & 0x7f;
        while (ofsByte & 0x80) {
          ofsByte = packBuffer[pos++];
          relOffset = ((relOffset + 1) << 7) | (ofsByte & 0x7f);
        }
        const deltaData = zlib.inflateSync(packBuffer.subarray(pos));
        const baseObj = this.readPackObject(packBuffer, offset - relOffset, hashLenBytes, resolveRef, depth + 1);
        if (!baseObj) return null;
        const reconstructed = this.applyGitDelta(baseObj.data, deltaData);
        return { type: baseObj.type, size: reconstructed.length, data: reconstructed };
      }

      if (typeId === 7) {
        // REF_DELTA
        const baseOid = packBuffer.subarray(pos, pos + hashLenBytes).toString('hex');
        pos += hashLenBytes;
        const deltaData = zlib.inflateSync(packBuffer.subarray(pos));
        const baseObj = resolveRef ? resolveRef(baseOid) : null;
        if (!baseObj) return null;
        const reconstructed = this.applyGitDelta(baseObj.data, deltaData);
        return { type: baseObj.type, size: reconstructed.length, data: reconstructed };
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Reads any Git object (loose or packed) by SHA-1 / SHA-256 object ID completely offline.
   */
  public readGitObject(commonDir: string, oid: string): OfflineGitObject | null {
    const loose = this.readLooseObject(commonDir, oid);
    if (loose) return loose;

    const cleanOid = oid.trim().toLowerCase();
    if (!this.isValidObjectId(cleanOid)) return null;
    const hashLenBytes = cleanOid.length / 2;

    try {
      const packDir = path.join(commonDir, 'objects', 'pack');
      if (!fs.existsSync(packDir)) return null;

      const idxFiles = fs.readdirSync(packDir).filter((f) => f.endsWith('.idx'));
      for (const idxFile of idxFiles) {
        const idxBuf = fs.readFileSync(path.join(packDir, idxFile));
        const hit = this.readPackIndexV2(idxBuf, cleanOid, hashLenBytes);
        if (hit) {
          const packPath = path.join(packDir, idxFile.replace(/\.idx$/i, '.pack'));
          if (!fs.existsSync(packPath)) continue;
          const packBuf = fs.readFileSync(packPath);
          return this.readPackObject(packBuf, hit.offset, hashLenBytes, (refOid) =>
            this.readGitObject(commonDir, refOid)
          );
        }
      }
    } catch {}

    return null;
  }

  /**
   * Parses raw uncompressed commit object payload into structured commit metadata.
   */
  public parseCommitObject(oid: string, raw: Buffer): OfflineCommitObject {
    const text = raw.toString('utf8');
    const splitIdx = text.indexOf('\n\n');
    const headerBlock = splitIdx !== -1 ? text.slice(0, splitIdx) : text;
    const message = splitIdx !== -1 ? text.slice(splitIdx + 2).trim() : '';

    let tree = '';
    const parents: string[] = [];
    let author = '';
    let committer = '';

    for (const line of headerBlock.split('\n')) {
      if (line.startsWith('tree ')) tree = line.slice(5).trim();
      else if (line.startsWith('parent ')) parents.push(line.slice(7).trim());
      else if (line.startsWith('author ')) author = line.slice(7).trim();
      else if (line.startsWith('committer ')) committer = line.slice(10).trim();
    }

    return { hash: oid, tree, parents, author, committer, message };
  }

  /**
   * Parses binary Git tree object entries (<mode> <name>\0<hashBytes>).
   */
  public parseTreeObject(raw: Buffer, hashLenBytes = 20): OfflineTreeEntry[] {
    const entries: OfflineTreeEntry[] = [];
    let pos = 0;

    while (pos < raw.length) {
      const spaceIdx = raw.indexOf(0x20, pos);
      const nullIdx = raw.indexOf(0x00, pos);
      if (spaceIdx === -1 || nullIdx === -1 || nullIdx + 1 + hashLenBytes > raw.length) {
        break;
      }

      const mode = raw.subarray(pos, spaceIdx).toString('utf8');
      const name = raw.subarray(spaceIdx + 1, nullIdx).toString('utf8');
      const hashStart = nullIdx + 1;
      const hash = raw.subarray(hashStart, hashStart + hashLenBytes).toString('hex');
      pos = hashStart + hashLenBytes;

      let type: OfflineTreeEntry['type'] = 'blob';
      if (mode === '40000' || mode === '040000') type = 'tree';
      else if (mode === '160000') type = 'commit';

      entries.push({ mode, type, name, hash });
    }

    return entries;
  }

  /**
   * Parses the binary .git/index file (DIRC v2, v3, v4) completely offline.
   */
  public readIndexEntries(gitDir: string, commonDir?: string): OfflineGitIndexEntry[] {
    const entries: OfflineGitIndexEntry[] = [];
    try {
      const indexFile = path.join(gitDir, 'index');
      if (!fs.existsSync(indexFile)) return entries;

      const buf = fs.readFileSync(indexFile);
      if (buf.length < 12 || buf.subarray(0, 4).toString('ascii') !== 'DIRC') {
        return entries;
      }

      const version = buf.readUInt32BE(4);
      const count = buf.readUInt32BE(8);
      if (version < 2 || version > 4) return entries;

      const algo = commonDir ? this.detectHashAlgorithm(commonDir) : 'sha1';
      const hashLenBytes = algo === 'sha256' ? 32 : 20;

      let pos = 12;
      let prevPath = '';

      for (let i = 0; i < count && pos + 42 + hashLenBytes <= buf.length; i++) {
        const entryStart = pos;
        const mtimeSec = buf.readUInt32BE(pos + 8);
        const mtimeNano = buf.readUInt32BE(pos + 12);
        const mode = buf.readUInt32BE(pos + 24);
        const size = buf.readUInt32BE(pos + 36);

        const hashOffset = pos + 40;
        const sha1 = buf.subarray(hashOffset, hashOffset + hashLenBytes).toString('hex');

        const flags = buf.readUInt16BE(hashOffset + hashLenBytes);
        const assumeValid = Boolean(flags & 0x8000);
        const extended = Boolean(flags & 0x4000);
        const stage = (flags >> 12) & 0x03;

        pos = hashOffset + hashLenBytes + 2;
        if (version >= 3 && extended && pos + 2 <= buf.length) {
          pos += 2; // skip extended flags
        }

        let entryPath = '';
        if (version === 4) {
          let varByte = buf[pos++];
          let stripLen = varByte & 0x7f;
          while (varByte & 0x80) {
            varByte = buf[pos++];
            stripLen = ((stripLen + 1) << 7) | (varByte & 0x7f);
          }
          const nullIdx = buf.indexOf(0x00, pos);
          if (nullIdx === -1) break;
          const suffix = buf.subarray(pos, nullIdx).toString('utf8');
          entryPath = prevPath.slice(0, Math.max(0, prevPath.length - stripLen)) + suffix;
          pos = nullIdx + 1;
        } else {
          const nullIdx = buf.indexOf(0x00, pos);
          if (nullIdx === -1) break;
          entryPath = buf.subarray(pos, nullIdx).toString('utf8');
          pos = nullIdx + 1;
          const rem = (pos - entryStart) % 8;
          if (rem !== 0) {
            pos += 8 - rem;
          }
        }

        prevPath = entryPath;
        entries.push({
          path: entryPath,
          sha1,
          size,
          mtimeMs: mtimeSec * 1000 + Math.floor(mtimeNano / 1_000_000),
          mode,
          flags,
          assumeValid,
          stage,
        });
      }
    } catch {}
    return entries;
  }

  /**
   * Computes offline working tree status by comparing .git/index entries with disk stats.
   */
  public computeOfflineWorkingTreeStatus(
    repoPath: string,
    gitDir?: string,
    commonDir?: string
  ): OfflineWorkingTreeStatus {
    const resolved = gitDir && commonDir ? { gitDir, commonDir } : this.resolveGitDir(repoPath);
    if (!resolved) {
      return { stagedCount: 0, unstagedModified: [], untracked: [], totalIndexEntries: 0 };
    }

    const indexEntries = this.readIndexEntries(resolved.gitDir, resolved.commonDir);
    const unstagedModified: string[] = [];
    const seen = new Set<string>();

    for (const entry of indexEntries) {
      if (entry.stage !== 0 || seen.has(entry.path)) continue;
      seen.add(entry.path);
      const absPath = path.join(repoPath, entry.path);
      try {
        if (!fs.existsSync(absPath)) {
          unstagedModified.push(entry.path);
          continue;
        }
        const stat = fs.statSync(absPath);
        if (stat.size !== entry.size || Math.abs(stat.mtimeMs - entry.mtimeMs) > 2000) {
          unstagedModified.push(entry.path);
        }
      } catch {
        unstagedModified.push(entry.path);
      }
    }

    return {
      stagedCount: indexEntries.filter((e) => e.stage === 0).length,
      unstagedModified,
      untracked: [],
      totalIndexEntries: seen.size,
    };
  }
}
