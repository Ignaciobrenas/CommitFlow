import { WebviewToExtensionMessage } from '../git/types';

export const ALLOWED_WEBVIEW_COMMANDS: ReadonlySet<WebviewToExtensionMessage['command']> = new Set<
  WebviewToExtensionMessage['command']
>([
  'ready',
  'requestData',
  'requestCommitFiles',
  'checkoutBranch',
  'checkoutCommit',
  'pullBranch',
  'rebaseBranch',
  'mergeBranch',
  'abortRebase',
  'stashSave',
  'stashPop',
  'stashApply',
  'stashDrop',
  'openFile',
  'saveSettings',
  'openSettings',
  'copyToClipboard',
  'openExternal',
  'openCommit',
  'openDiff',
  'openFullPanel',
  'filter',
  'requestWorktrees',
  'addWorktree',
  'removeWorktree',
  'openWorktree',
  'requestPullRequests',
  'checkoutPullRequest',
  'requestFileHistory',
  'openFileHistoryDiff',
  'createCloudPatch',
  'applyCloudPatch',
  'deleteCloudPatch',
  'requestCloudPatches',
  'setLayoutMode',
  'cherryPickCommit',
  'revertCommit',
  'createTag',
  'deleteTag',
  'undoLastCommit',
  'generateChangelog',
  'requestIssues',
  'startWorkOnIssue',
  'insertIssueRef',
  'requestIssueDetails',
  'createIssueComment',
  'setIssueState',
  'openInFork',
  'requestReflog',
  'restoreReflogCommit',
  'compareCommits',
  'requestRepoHealth',
  'runRepoGc',
  'startBisect',
  'stepBisect',
  'resetBisect',
  'requestBisectStatus',
  'previewCherryPick',
  'requestRepositories',
  'switchRepository',
  'requestRebaseCommits',
  'simulateRebase',
  'startInteractiveRebase',
  'continueRebase',
  'skipRebase',
  'requestAiKeys',
  'generateAiKey',
  'revokeAiKey',
  'applyDagFilters',
  'dndResetBranchToCommit',
  'dndCherryPickToBranch',
  'dndRebaseOntoCommit',
  'requestConflictedFiles',
  'resolveConflictFile',
  'openMergeEditor',
  'abortMerge',
  'requestCommitTemplate',
  'commitStagedChanges',
  'requestPrComments',
  'addPrComment',
  'approvePullRequest',
]);

export interface IpcValidationResult {
  valid: boolean;
  reason?: string;
  command?: WebviewToExtensionMessage['command'];
}

const HASH_OR_REF_REGEX = /^[0-9a-fA-F]{4,64}$|^HEAD(?:~\d+)?$/;
const SAFE_BRANCH_OR_TAG_REGEX = /^(?!-)(?!.*\.\.)(?!.*@\{)(?!.*[\x00-\x1f\x7f ~^:?*\[\\]).{1,255}$/;
const PATH_KEYS = new Set(['filePath', 'worktreePath', 'repoPath', 'activeRepo', 'path', 'cwd']);
const HASH_KEYS = new Set(['commitHash', 'targetHash', 'baseHash', 'hash', 'badCommit', 'goodCommit']);

function hasUnsafePathTraversal(value: string): boolean {
  if (value.includes('\0')) return true;
  const normalizedSegments = value.replace(/\\/g, '/').split('/');
  return normalizedSegments.some((segment) => segment === '..');
}

function scanPayloadSafety(value: unknown, keyName = '', depth = 0): string | null {
  if (depth > 8 || value === undefined || value === null) return null;

  if (typeof value === 'string') {
    if (value.includes('\0')) {
      return `Null byte detected in ${keyName || 'payload'}`;
    }
    if (PATH_KEYS.has(keyName) && value.length > 0 && hasUnsafePathTraversal(value)) {
      return `Path traversal detected in ${keyName}`;
    }
    if (HASH_KEYS.has(keyName) && value.length > 0 && !HASH_OR_REF_REGEX.test(value)) {
      return `Invalid commit hash format in ${keyName}`;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const err = scanPayloadSafety(value[i], keyName, depth + 1);
      if (err) return err;
    }
    return null;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return `Prototype pollution key rejected: ${key}`;
      }
      const err = scanPayloadSafety(record[key], key, depth + 1);
      if (err) return err;
    }
  }

  return null;
}

/**
 * Runtime schema & security validator for all messages received from the CommitFlow webview.
 */
export class IpcSchemaValidator {
  public static validateWebviewMessage(raw: unknown): IpcValidationResult {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { valid: false, reason: 'Message must be a non-null plain object.' };
    }

    const msg = raw as Record<string, unknown>;
    const command = msg.command;
    if (typeof command !== 'string' || !ALLOWED_WEBVIEW_COMMANDS.has(command as WebviewToExtensionMessage['command'])) {
      return { valid: false, reason: `Unknown or disallowed IPC command: ${String(command)}` };
    }

    const safetyError = scanPayloadSafety(msg);
    if (safetyError) {
      return { valid: false, reason: safetyError };
    }

    const payload = msg.payload as any;

    if (command === 'openExternal') {
      if (typeof payload !== 'string' || !/^https?:\/\//i.test(payload.trim())) {
        return { valid: false, reason: 'openExternal requires an http:// or https:// URL.' };
      }
    }

    if (command === 'resolveConflictFile') {
      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof payload.filePath !== 'string' ||
        !['ours', 'theirs', 'mark-resolved'].includes(payload.strategy)
      ) {
        return { valid: false, reason: 'resolveConflictFile requires valid filePath and strategy.' };
      }
    }

    if (command === 'dndResetBranchToCommit') {
      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof payload.branchName !== 'string' ||
        !SAFE_BRANCH_OR_TAG_REGEX.test(payload.branchName) ||
        typeof payload.targetHash !== 'string' ||
        !HASH_OR_REF_REGEX.test(payload.targetHash)
      ) {
        return { valid: false, reason: 'dndResetBranchToCommit requires valid branchName and targetHash.' };
      }
    }

    if (command === 'checkoutBranch' && typeof payload === 'string' && !SAFE_BRANCH_OR_TAG_REGEX.test(payload)) {
      return { valid: false, reason: 'checkoutBranch contains invalid ref characters.' };
    }

    if (command === 'commitStagedChanges') {
      if (!payload || typeof payload !== 'object' || typeof payload.message !== 'string' || !payload.message.trim()) {
        return { valid: false, reason: 'commitStagedChanges requires a non-empty message.' };
      }
    }

    return {
      valid: true,
      command: command as WebviewToExtensionMessage['command'],
    };
  }
}
