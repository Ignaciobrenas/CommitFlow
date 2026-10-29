import * as fs from 'fs';
import * as path from 'path';

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
  operationState: OfflineOperationState;
  lastCommitMessage?: string;
  recentCommitsFromReflog: OfflineGitCommitEntry[];
  userName?: string;
  userEmail?: string;
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
      operationState,
      lastCommitMessage,
      recentCommitsFromReflog,
      userName: configInfo.userName,
      userEmail: configInfo.userEmail,
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
   * Reads .git/config to extract remotes, upstream tracking, and user info.
   */
  public readConfig(commonDir: string): {
    remotes: OfflineGitRemote[];
    branchUpstreams: Map<string, string>;
    userName?: string;
    userEmail?: string;
  } {
    const remotesMap = new Map<string, OfflineGitRemote>();
    const branchUpstreams = new Map<string, string>();
    let userName: string | undefined;
    let userEmail: string | undefined;

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
        }
      }
    } catch {}

    return {
      remotes: Array.from(remotesMap.values()),
      branchUpstreams,
      userName,
      userEmail,
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
            if (/^[0-9a-f]{40}$/i.test(sha)) {
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

        // Format: <old-sha> <new-sha> <name> <<email>> <timestamp> <tz>
        const match = header.match(/^([0-9a-f]{40})\s+([0-9a-f]{40})\s+([^<]+)<([^>]+)>\s+(\d+)\s+([+\-\d]+)$/);
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
}
